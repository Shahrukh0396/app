import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfLib from 'pdf-lib';
import { configure, lock } from 'pdf-lib-encrypt';
import { PageSizeName } from '@scanflow/types';
import { layoutReceipts } from './layout';

configure(pdfLib);

const PAGE_SIZES: Record<PageSizeName, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 },
  LEGAL: { width: 612, height: 1008 },
};

export interface PdfImagePage {
  bytes: Uint8Array;
  mime: 'image/jpeg' | 'image/png';
  ocrText?: string;
}

export async function buildScanPdf(
  pages: PdfImagePage[],
  options: { pageSize?: PageSizeName; watermark?: string; password?: string } = {},
): Promise<Uint8Array> {
  const size = PAGE_SIZES[options.pageSize ?? 'A4'];
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const pageInput of pages) {
    const image =
      pageInput.mime === 'image/png' ? await doc.embedPng(pageInput.bytes) : await doc.embedJpg(pageInput.bytes);
    const page = doc.addPage([size.width, size.height]);
    const scale = Math.min((size.width - 72) / image.width, (size.height - 72) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height });
    if (pageInput.ocrText) {
      page.drawText(pageInput.ocrText.replace(/[^\x20-\x7E]/g, ' ').slice(0, 2000), {
        x: 36,
        y: 24,
        size: 8,
        font,
        color: rgb(1, 1, 1),
        opacity: 0.01,
      });
    }
    if (options.watermark) {
      page.drawText(options.watermark, {
        x: 80,
        y: size.height / 2,
        size: 32,
        font,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.3,
        rotate: degrees(32),
      });
    }
  }
  const saved = await doc.save({ useObjectStreams: false });
  if (!options.password) return saved;
  return lock(saved, options.password);
}

export async function buildReceiptSheet(images: PdfImagePage[], pageSize: PageSizeName = 'A4'): Promise<Uint8Array> {
  const size = PAGE_SIZES[pageSize];
  const slots = layoutReceipts(size.width, size.height, images.length);
  const doc = await PDFDocument.create();
  const page = doc.addPage([size.width, size.height]);
  for (let index = 0; index < images.length; index += 1) {
    const imageInput = images[index];
    const slot = slots[index];
    if (!imageInput || !slot) continue;
    const embedded =
      imageInput.mime === 'image/png' ? await doc.embedPng(imageInput.bytes) : await doc.embedJpg(imageInput.bytes);
    const scale = Math.min(slot.width / embedded.width, slot.height / embedded.height);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    page.drawImage(embedded, {
      x: slot.x + (slot.width - width) / 2,
      y: size.height - slot.y - slot.height + (slot.height - height) / 2,
      width,
      height,
    });
  }
  return doc.save();
}

export async function mergePdfs(buffers: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const buffer of buffers) {
    const src = await PDFDocument.load(buffer);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((page) => out.addPage(page));
  }
  return out.save();
}

export async function rotatePdfPage(buffer: Uint8Array, pageIndex: number, rotation: 90 | 180 | 270): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer);
  const page = doc.getPage(pageIndex);
  page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
  return doc.save();
}
