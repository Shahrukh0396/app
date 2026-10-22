import type { Quad } from './homography';
import { detectDocumentQuad, isQuadStable, rgbaToLuminance } from './quadDetector';

function pageOnDark(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const page = x >= 8 && x <= 28 && y >= 6 && y <= 26;
      const offset = (y * width + x) * 4;
      const value = page ? 245 : 12;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

describe('quad detector', () => {
  it('finds the bright page corners from luminance edges', () => {
    const width = 36;
    const height = 32;
    const gray = rgbaToLuminance(pageOnDark(width, height), width, height);
    const quad = detectDocumentQuad(gray);
    expect(quad).not.toBeNull();
    const xs = quad?.map((point) => point.x) ?? [];
    const ys = quad?.map((point) => point.y) ?? [];
    expect(Math.min(...xs)).toBeLessThan(12);
    expect(Math.max(...xs)).toBeGreaterThan(24);
    expect(Math.min(...ys)).toBeLessThan(10);
    expect(Math.max(...ys)).toBeGreaterThan(22);
  });

  it('requires three similar quads before auto-capture is stable', () => {
    const quad: Quad = [
      { x: 1, y: 1 },
      { x: 10, y: 1 },
      { x: 10, y: 12 },
      { x: 1, y: 12 },
    ];
    expect(isQuadStable([quad, quad], 2)).toBe(false);
    expect(isQuadStable([quad, quad, quad], 2)).toBe(true);
  });
});
