import { dotAt, extendPattern, patternDots } from './pattern';

describe('pattern gesture', () => {
  const dots = patternDots(240);

  it('records a pan across dots and ignores a dot already used', () => {
    const radius = 28;
    let sequence: number[] = [];
    for (const point of [
      { x: dots[0]?.x ?? 0, y: dots[0]?.y ?? 0 },
      { x: dots[1]?.x ?? 0, y: dots[1]?.y ?? 0 },
      { x: dots[1]?.x ?? 0, y: dots[1]?.y ?? 0 },
      { x: dots[2]?.x ?? 0, y: dots[2]?.y ?? 0 },
      { x: dots[5]?.x ?? 0, y: dots[5]?.y ?? 0 },
    ]) {
      sequence = extendPattern(sequence, dotAt(dots, point.x, point.y, radius));
    }
    expect(sequence).toEqual([0, 1, 2, 5]);
  });

  it('misses the gaps between dots', () => {
    expect(dotAt(dots, 0, 0, 20)).toBeNull();
  });
});