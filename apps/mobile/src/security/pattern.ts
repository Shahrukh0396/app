export interface PatternDot {
  index: number;
  x: number;
  y: number;
}

export function patternDots(size: number): PatternDot[] {
  const step = size / 4;
  const dots: PatternDot[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      dots.push({ index: row * 3 + column, x: step + column * step, y: step + row * step });
    }
  }
  return dots;
}

export function dotAt(dots: PatternDot[], x: number, y: number, radius: number): number | null {
  for (const dot of dots) {
    if (Math.hypot(dot.x - x, dot.y - y) <= radius) return dot.index;
  }
  return null;
}

export function extendPattern(sequence: number[], cell: number | null): number[] {
  if (cell === null || sequence.includes(cell)) return sequence;
  return [...sequence, cell];
}
