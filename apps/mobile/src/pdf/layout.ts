export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutReceipts(
  pageWidth: number,
  pageHeight: number,
  count: number,
  margin = 36,
  gap = 12,
): Rect[] {
  if (count <= 0) return [];
  if (pageWidth <= margin * 2 || pageHeight <= margin * 2) {
    throw new Error('Page is smaller than the requested margins');
  }
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellWidth = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
  const cellHeight = (pageHeight - margin * 2 - gap * (rows - 1)) / rows;
  if (cellWidth <= 0 || cellHeight <= 0) {
    throw new Error('Receipt grid does not fit on the page');
  }
  const rects: Rect[] = [];
  for (let index = 0; index < count; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    rects.push({
      x: margin + col * (cellWidth + gap),
      y: margin + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
    });
  }
  return rects;
}
