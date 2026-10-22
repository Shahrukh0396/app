export interface Point {
  x: number;
  y: number;
}

export type Quad = [Point, Point, Point, Point];

export type Matrix3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const EPSILON = 1e-10;

export function solveLinear(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index] ?? 0]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    let max = Math.abs(a[col]?.[col] ?? 0);
    for (let row = col + 1; row < n; row += 1) {
      const value = Math.abs(a[row]?.[col] ?? 0);
      if (value > max) {
        max = value;
        pivot = row;
      }
    }
    if (max < EPSILON) {
      throw new Error('Homography system is singular');
    }
    if (pivot !== col) {
      const current = a[col];
      const swap = a[pivot];
      if (!current || !swap) throw new Error('Homography system is singular');
      a[col] = swap;
      a[pivot] = current;
    }
    const pivotRow = a[col];
    if (!pivotRow) throw new Error('Homography system is singular');
    const divisor = pivotRow[col] ?? 0;
    for (let column = col; column <= n; column += 1) {
      pivotRow[column] = (pivotRow[column] ?? 0) / divisor;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const target = a[row];
      if (!target) continue;
      const factor = target[col] ?? 0;
      for (let column = col; column <= n; column += 1) {
        target[column] = (target[column] ?? 0) - factor * (pivotRow[column] ?? 0);
      }
    }
  }
  return a.map((row) => row[n] ?? 0);
}

export function computeHomography(src: Quad, dst: Quad): Matrix3 {
  const rows: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const source = src[index];
    const dest = dst[index];
    if (!source || !dest) throw new Error('A quad needs four points');
    const { x, y } = source;
    const { x: u, y: v } = dest;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const h = solveLinear(rows, values);
  return [h[0] ?? 0, h[1] ?? 0, h[2] ?? 0, h[3] ?? 0, h[4] ?? 0, h[5] ?? 0, h[6] ?? 0, h[7] ?? 0, 1];
}

export function applyHomography(matrix: Matrix3, point: Point): Point {
  const [h00, h01, h02, h10, h11, h12, h20, h21, h22] = matrix;
  const w = h20 * point.x + h21 * point.y + h22;
  if (Math.abs(w) < EPSILON) throw new Error('Homography mapped a point to infinity');
  return {
    x: (h00 * point.x + h01 * point.y + h02) / w,
    y: (h10 * point.x + h11 * point.y + h12) / w,
  };
}

export function invertHomography(matrix: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < EPSILON) throw new Error('Homography is not invertible');
  const inv = 1 / det;
  return [
    (e * i - f * h) * inv,
    (c * h - b * i) * inv,
    (b * f - c * e) * inv,
    (f * g - d * i) * inv,
    (a * i - c * g) * inv,
    (c * d - a * f) * inv,
    (d * h - e * g) * inv,
    (b * g - a * h) * inv,
    (a * e - b * d) * inv,
  ];
}

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function sampleBilinear(image: RgbaImage, x: number, y: number): [number, number, number, number] {
  if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1) return [0, 0, 0, 0];
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, image.width - 1);
  const y1 = Math.min(y0 + 1, image.height - 1);
  const tx = x - x0;
  const ty = y - y0;
  const pixel = (px: number, py: number) => {
    const offset = (py * image.width + px) * 4;
    return [
      image.data[offset] ?? 0,
      image.data[offset + 1] ?? 0,
      image.data[offset + 2] ?? 0,
      image.data[offset + 3] ?? 0,
    ];
  };
  const p00 = pixel(x0, y0);
  const p10 = pixel(x1, y0);
  const p01 = pixel(x0, y1);
  const p11 = pixel(x1, y1);
  return [0, 1, 2, 3].map((channel) => {
    const top = (p00[channel] ?? 0) * (1 - tx) + (p10[channel] ?? 0) * tx;
    const bottom = (p01[channel] ?? 0) * (1 - tx) + (p11[channel] ?? 0) * tx;
    return Math.round(top * (1 - ty) + bottom * ty);
  }) as [number, number, number, number];
}

export function warpPerspective(image: RgbaImage, quad: Quad, outWidth: number, outHeight: number): RgbaImage {
  if (outWidth < 1 || outHeight < 1) throw new Error('Output size must be positive');
  const destination: Quad = [
    { x: 0, y: 0 },
    { x: outWidth - 1, y: 0 },
    { x: outWidth - 1, y: outHeight - 1 },
    { x: 0, y: outHeight - 1 },
  ];
  const inverse = invertHomography(computeHomography(quad, destination));
  const data = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const source = applyHomography(inverse, { x, y });
      const [r, g, b, a] = sampleBilinear(image, source.x, source.y);
      const offset = (y * outWidth + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return { width: outWidth, height: outHeight, data };
}

export function orderQuad(points: Quad): Quad {
  const sorted = [...points].sort((left, right) => left.y - right.y || left.x - right.x);
  const top = (sorted.slice(0, 2) as [Point, Point]).sort((left, right) => left.x - right.x);
  const bottom = (sorted.slice(2, 4) as [Point, Point]).sort((left, right) => left.x - right.x);
  const tl = top[0];
  const tr = top[1];
  const bl = bottom[0];
  const br = bottom[1];
  if (!tl || !tr || !br || !bl) throw new Error('A quad needs four points');
  return [tl, tr, br, bl];
}
