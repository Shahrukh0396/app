import { orderQuad, type Point, type Quad } from './homography';

export interface GrayImage {
  width: number;
  height: number;
  pixels: Float32Array;
}

export function rgbaToLuminance(data: Uint8ClampedArray, width: number, height: number): GrayImage {
  const pixels = new Float32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    pixels[index] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return { width, height, pixels };
}

function gradientMagnitude(image: GrayImage): Float32Array {
  const { width, height, pixels } = image;
  const magnitude = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const left = pixels[y * width + (x - 1)] ?? 0;
      const right = pixels[y * width + (x + 1)] ?? 0;
      const up = pixels[(y - 1) * width + x] ?? 0;
      const down = pixels[(y + 1) * width + x] ?? 0;
      const gx = right - left;
      const gy = down - up;
      magnitude[y * width + x] = Math.hypot(gx, gy);
    }
  }
  return magnitude;
}

function percentile(values: Float32Array, ratio: number): number {
  const copy = Array.from(values).filter((value) => value > 0);
  if (copy.length === 0) return 0;
  copy.sort((a, b) => a - b);
  const index = Math.min(copy.length - 1, Math.floor(ratio * (copy.length - 1)));
  return copy[index] ?? 0;
}

export function detectDocumentQuad(image: GrayImage): Quad | null {
  const magnitude = gradientMagnitude(image);
  const threshold = Math.max(12, percentile(magnitude, 0.82));
  const points: Point[] = [];
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      if ((magnitude[y * image.width + x] ?? 0) >= threshold) points.push({ x, y });
    }
  }
  if (points.length < 16) return null;
  const regions: Point[][] = [[], [], [], []];
  const midX = image.width / 2;
  const midY = image.height / 2;
  for (const point of points) {
    const index = (point.y < midY ? 0 : 2) + (point.x < midX ? 0 : 1);
    regions[index]?.push(point);
  }
  const corners = regions.map((region, index) => extreme(region, index));
  if (corners.some((corner) => !corner)) return null;
  return orderQuad(corners as Quad);
}

function extreme(points: Point[], quadrant: number): Point | null {
  if (points.length === 0) return null;
  return points.reduce((best, point) => {
    const score =
      quadrant === 0
        ? point.x + point.y
        : quadrant === 1
          ? -point.x + point.y
          : quadrant === 2
            ? point.x - point.y
            : -point.x - point.y;
    const bestScore =
      quadrant === 0
        ? best.x + best.y
        : quadrant === 1
          ? -best.x + best.y
          : quadrant === 2
            ? best.x - best.y
            : -best.x - best.y;
    return score < bestScore ? point : best;
  });
}

export function quadMovement(a: Quad, b: Quad): number {
  return a.reduce((sum, point, index) => {
    const other = b[index];
    if (!other) return sum;
    return sum + Math.hypot(point.x - other.x, point.y - other.y);
  }, 0);
}

export function isQuadStable(history: Quad[], epsilon: number): boolean {
  if (history.length < 3) return false;
  const last = history[history.length - 1];
  if (!last) return false;
  return history.slice(-3).every((quad) => quadMovement(quad, last) <= epsilon);
}
