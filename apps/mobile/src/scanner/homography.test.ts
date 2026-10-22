import { applyHomography, computeHomography, solveLinear, warpPerspective, type Quad } from './homography';

describe('homography', () => {
  it('solves a linear system', () => {
    const solution = solveLinear(
      [
        [2, 1],
        [1, 3],
      ],
      [5, 5],
    );
    expect(solution[0]).toBeCloseTo(2);
    expect(solution[1]).toBeCloseTo(1);
  });

  it('maps a quad onto a rectangle', () => {
    const src: Quad = [
      { x: 10, y: 20 },
      { x: 110, y: 30 },
      { x: 100, y: 140 },
      { x: 5, y: 130 },
    ];
    const dst: Quad = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 300 },
      { x: 0, y: 300 },
    ];
    const matrix = computeHomography(src, dst);
    const mapped = src.map((point) => applyHomography(matrix, point));
    mapped.forEach((point, index) => {
      expect(point.x).toBeCloseTo(dst[index]?.x ?? 0, 4);
      expect(point.y).toBeCloseTo(dst[index]?.y ?? 0, 4);
    });
  });

  it('perspective-corrects a colored quad with bilinear sampling', () => {
    const width = 12;
    const height = 12;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside = x >= 2 && x <= 9 && y >= 2 && y <= 9;
        const offset = (y * width + x) * 4;
        data[offset] = inside ? 220 : 10;
        data[offset + 1] = inside ? 30 : 10;
        data[offset + 2] = inside ? 40 : 10;
        data[offset + 3] = 255;
      }
    }
    const quad: Quad = [
      { x: 2, y: 2 },
      { x: 9, y: 2 },
      { x: 9, y: 9 },
      { x: 2, y: 9 },
    ];
    const warped = warpPerspective({ width, height, data }, quad, 8, 8);
    const center = (4 * 8 + 4) * 4;
    expect(warped.data[center]).toBeGreaterThan(150);
    expect(warped.data[center + 1]).toBeLessThan(80);
    const corner = 0;
    expect(warped.data[corner]).toBeGreaterThan(150);
  });
});
