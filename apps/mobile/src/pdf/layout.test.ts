import { layoutReceipts } from './layout';

describe('layoutReceipts', () => {
  it('places a single receipt inside the margins', () => {
    const [rect] = layoutReceipts(612, 792, 1, 36, 12);
    expect(rect).toEqual({ x: 36, y: 36, width: 540, height: 720 });
  });

  it('uses a square-ish grid and keeps gutters between cells', () => {
    const rects = layoutReceipts(600, 800, 3, 20, 10);
    expect(rects).toHaveLength(3);
    expect(rects[0]?.x).toBe(20);
    expect(rects[1]?.x).toBeGreaterThan((rects[0]?.x ?? 0) + (rects[0]?.width ?? 0));
    expect(rects[2]?.y).toBeGreaterThan((rects[0]?.y ?? 0) + (rects[0]?.height ?? 0));
    const right = (rects[1]?.x ?? 0) + (rects[1]?.width ?? 0);
    expect(right).toBeCloseTo(580);
  });

  it('rejects a page that cannot hold the margin', () => {
    expect(() => layoutReceipts(40, 40, 1, 30, 8)).toThrow(/margins/);
  });
});
