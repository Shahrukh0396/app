import { Injectable } from '@nestjs/common';
import { PageSizeName } from '@scanflow/types';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfLib from 'pdf-lib';
import { configure, lock } from 'pdf-lib-encrypt';
import sharp from 'sharp';
import { PageSize, resolvePageSize } from './page-sizes';

configure(pdfLib);

export interface PdfPageInput {
  image: Buffer;
  mime: string;
  ocrText?: string;
}

export interface BuildPdfOptions {
  pageSize?: PageSizeName;
  watermark?: string;
  password?: string;
  compress?: boolean;
  jpegQuality?: number;
  maxEdge?: number;
}

@Injectable()
export class PdfService {
  async build(pages: PdfPageInput[], options: BuildPdfOptions = {}): Promise<Buffer> {
    const size = resolvePageSize(options.pageSize);
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const pageInput of pages) {
      const imageBytes = options.compress
        ? await this.reencodeImage(pageInput.image, {
            quality: options.jpegQuality ?? 60,
            maxEdge: options.maxEdge ?? 1600,
          })
        : await this.ensureJpegOrPng(pageInput.image, pageInput.mime);
      const mime = options.compress ? 'image/jpeg' : this.sniffMime(imageBytes, pageInput.mime);
      const embedded =
        mime === 'image/png' ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
      const page = doc.addPage([size.width, size.height]);
      const margin = 36;
      const maxWidth = size.width - margin * 2;
      const maxHeight = size.height - margin * 2;
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      const x = (size.width - width) / 2;
      const y = (size.height - height) / 2;
      page.drawImage(embedded, { x, y, width, height });
      const text = (pageInput.ocrText ?? '').trim();
      if (text) {
        page.drawText(this.clip(text, 4000), {
          x: margin,
          y: 18,
          size: 8,
          font,
          color: rgb(0, 0, 0),
          opacity: 0.01,
          maxWidth: size.width - margin * 2,
        });
      }
      if (options.watermark) {
        page.drawText(options.watermark, {
          x: size.width / 4,
          y: size.height / 2,
          size: 28,
          font,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.25,
          rotate: degrees(35),
        });
      }
    }
    const plain = Buffer.from(await doc.save({ useObjectStreams: false }));
    if (!options.password) return plain;
    const encrypted = await lock(plain, options.password);
    return Buffer.from(encrypted);
  }

  async merge(pdfs: Buffer[]): Promise<Buffer> {
    const out = await PDFDocument.create();
    for (const bytes of pdfs) {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
      const copied = await out.copyPages(src, src.getPageIndices());
      copied.forEach((page) => out.addPage(page));
    }
    return Buffer.from(await out.save());
  }

  async split(pdf: Buffer): Promise<Buffer[]> {
    const src = await PDFDocument.load(pdf);
    const parts: Buffer[] = [];
    for (const index of src.getPageIndices()) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(src, [index]);
      if (!page) continue;
      out.addPage(page);
      parts.push(Buffer.from(await out.save()));
    }
    return parts;
  }

  async rotatePage(pdf: Buffer, pageIndex: number, rotation: 90 | 180 | 270): Promise<Buffer> {
    const doc = await PDFDocument.load(pdf);
    const page = doc.getPage(pageIndex);
    page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
    return Buffer.from(await doc.save());
  }

  pageSize(name: PageSizeName | undefined): PageSize {
    return resolvePageSize(name);
  }

  async reencodeImage(input: Buffer, options: { quality: number; maxEdge: number }): Promise<Buffer> {
    return sharp(input)
      .rotate()
      .resize({
        width: options.maxEdge,
        height: options.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: options.quality, mozjpeg: true })
      .toBuffer();
  }

  private async ensureJpegOrPng(input: Buffer, mime: string): Promise<Buffer> {
    const sniffed = this.sniffMime(input, mime);
    if (sniffed === 'image/jpeg' || sniffed === 'image/png') return input;
    return sharp(input).jpeg({ quality: 85 }).toBuffer();
  }

  private sniffMime(bytes: Buffer, fallback: string): 'image/jpeg' | 'image/png' | string {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    return fallback;
  }

  private clip(value: string, max: number): string {
    let clean = '';
    for (const char of value) {
      const code = char.charCodeAt(0);
      const printable = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
      clean += printable ? (code === 9 || code === 13 ? ' ' : char) : ' ';
    }
    return clean.length <= max ? clean : clean.slice(0, max);
  }
}
