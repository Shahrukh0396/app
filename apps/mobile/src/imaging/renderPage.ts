import type { Quad } from '../scanner/homography';
import {
  applyAdjustments,
  applyNamedFilter,
  flipHorizontal,
  rotateClockwise,
  type Adjustments,
  type FilterName,
  type RgbaImage,
} from './filters';

export function renderScanImage(
  image: RgbaImage,
  options: { filter: FilterName; adjustments: Adjustments; flipped: boolean; rotation: number },
): RgbaImage {
  let next = applyNamedFilter(image, options.filter);
  next = applyAdjustments(next, options.adjustments);
  if (options.flipped) next = flipHorizontal(next);
  const turns = ((Math.round(options.rotation / 90) % 4) + 4) % 4;
  for (let turn = 0; turn < turns; turn += 1) next = rotateClockwise(next);
  return next;
}

export function quadOutputSize(quad: Quad, maxEdge = 2000): { width: number; height: number } {
  const distance = (start: Quad[number], end: Quad[number]) => Math.hypot(start.x - end.x, start.y - end.y);
  let width = Math.max(1, Math.round((distance(quad[0], quad[1]) + distance(quad[3], quad[2])) / 2));
  let height = Math.max(1, Math.round((distance(quad[0], quad[3]) + distance(quad[1], quad[2])) / 2));
  const edge = Math.max(width, height);
  if (edge > maxEdge) {
    const scale = maxEdge / edge;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  return { width, height };
}
