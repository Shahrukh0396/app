import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { PdfService } from './pdf.service';

function pdfText(bytes: Buffer): string {
  const latin = bytes.toString('latin1');
  const parts = [latin];
  const streams = latin.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  for (const match of streams) {
    const raw = match[1];
    if (!raw) continue;
    try {
      parts.push(inflateSync(Buffer.from(raw, 'latin1')).toString('latin1'));
    } catch {
      parts.push(raw);
    }
  }
  return parts
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>/g, (_match, hex: string) => {
      let text = '';
      for (let index = 0; index < hex.length; index += 2) {
        text += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16));
      }
      return text;
    });
}

async function png(width: number, height: number): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  return sharp({
    create: { width, height, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .png()
    .toBuffer();
}

describe('PdfService', () => {
  const service = new PdfService();

  it('builds a searchable PDF with a text layer and optional watermark', async () => {
    const image = await png(40, 60);
    const bytes = await service.build(
      [{ image, mime: 'image/png', ocrText: 'Invoice 1042' }],
      { pageSize: 'A4', watermark: 'SCANFLOW' },
    );
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const size = doc.getPage(0).getSize();
    expect(size.width).toBeCloseTo(595.28, 1);
    expect(pdfText(Buffer.from(bytes))).toContain('Invoice');
  });

  it('password-protects the PDF so the plain document no longer loads', async () => {
    const image = await png(20, 20);
    const plain = await service.build([{ image, mime: 'image/png', ocrText: 'secret' }]);
    const locked = await service.build([{ image, mime: 'image/png', ocrText: 'secret' }], {
      password: 'correct horse',
    });
    expect(locked.equals(plain)).toBe(false);
    expect(locked.toString('latin1')).toContain('/Encrypt');
    await expect(PDFDocument.load(locked)).rejects.toThrow();
  });

  it('merges and splits pages', async () => {
    const image = await png(16, 16);
    const first = await service.build([{ image, mime: 'image/png', ocrText: 'one' }]);
    const second = await service.build([{ image, mime: 'image/png', ocrText: 'two' }]);
    const merged = await service.merge([first, second]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(2);
    const parts = await service.split(merged);
    expect(parts).toHaveLength(2);
    expect((await PDFDocument.load(parts[0] as Buffer)).getPageCount()).toBe(1);
  });

  it('re-encodes an image to a smaller jpeg when asked to compress', async () => {
    const image = await png(800, 800);
    const compressed = await service.reencodeImage(image, { quality: 40, maxEdge: 200 });
    expect(compressed.length).toBeLessThan(image.length);
    expect(compressed[0]).toBe(0xff);
    expect(compressed[1]).toBe(0xd8);
  });
});
