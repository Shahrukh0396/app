export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  temperature: number;
  denoise: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  temperature: 0,
  denoise: 0,
};

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

export function cloneImage(image: RgbaImage): RgbaImage {
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

function mapPixels(image: RgbaImage, fn: (r: number, g: number, b: number, a: number) => [number, number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const [r, g, b, a] = fn(image.data[offset] ?? 0, image.data[offset + 1] ?? 0, image.data[offset + 2] ?? 0, image.data[offset + 3] ?? 0);
    data[offset] = clampByte(r);
    data[offset + 1] = clampByte(g);
    data[offset + 2] = clampByte(b);
    data[offset + 3] = clampByte(a);
  }
  return { width: image.width, height: image.height, data };
}

export function applyBrightness(image: RgbaImage, amount: number): RgbaImage {
  const delta = (amount / 100) * 255;
  return mapPixels(image, (r, g, b, a) => [r + delta, g + delta, b + delta, a]);
}

export function applyContrast(image: RgbaImage, amount: number): RgbaImage {
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  return mapPixels(image, (r, g, b, a) => [factor * (r - 128) + 128, factor * (g - 128) + 128, factor * (b - 128) + 128, a]);
}

export function applySaturation(image: RgbaImage, amount: number): RgbaImage {
  const factor = 1 + amount / 100;
  return mapPixels(image, (r, g, b, a) => {
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [gray + (r - gray) * factor, gray + (g - gray) * factor, gray + (b - gray) * factor, a];
  });
}

export function applyGrayscale(image: RgbaImage): RgbaImage {
  return mapPixels(image, (r, g, b, a) => {
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [gray, gray, gray, a];
  });
}

export function applyWhiteBalance(image: RgbaImage, temperature: number): RgbaImage {
  const shift = (temperature / 100) * 40;
  return mapPixels(image, (r, g, b, a) => [r + shift, g, b - shift, a]);
}

export function applyBlackAndWhite(image: RgbaImage, threshold = 160): RgbaImage {
  const gray = applyGrayscale(image);
  return mapPixels(gray, (r, _g, _b, a) => {
    const value = r >= threshold ? 255 : 0;
    return [value, value, value, a];
  });
}

function convolve(image: RgbaImage, kernel: number[], radius: number): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  const side = radius * 2 + 1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let ky = -radius; ky <= radius; ky += 1) {
        for (let kx = -radius; kx <= radius; kx += 1) {
          const px = Math.min(image.width - 1, Math.max(0, x + kx));
          const py = Math.min(image.height - 1, Math.max(0, y + ky));
          const weight = kernel[(ky + radius) * side + (kx + radius)] ?? 0;
          const offset = (py * image.width + px) * 4;
          r += (image.data[offset] ?? 0) * weight;
          g += (image.data[offset + 1] ?? 0) * weight;
          b += (image.data[offset + 2] ?? 0) * weight;
          a += (image.data[offset + 3] ?? 0) * weight;
        }
      }
      const offset = (y * image.width + x) * 4;
      data[offset] = clampByte(r);
      data[offset + 1] = clampByte(g);
      data[offset + 2] = clampByte(b);
      data[offset + 3] = clampByte(a);
    }
  }
  return { width: image.width, height: image.height, data };
}

export function applySharpen(image: RgbaImage, amount: number): RgbaImage {
  if (amount === 0) return cloneImage(image);
  const center = 1 + Math.abs(amount) / 25;
  const edge = (1 - center) / 4;
  return convolve(image, [0, edge, 0, edge, center, edge, 0, edge, 0], 1);
}

export function boxBlur(image: RgbaImage, radius: number): RgbaImage {
  const size = radius * 2 + 1;
  const weight = 1 / (size * size);
  return convolve(image, Array.from({ length: size * size }, () => weight), radius);
}

export function medianDenoise(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const window: number[][] = [[], [], [], []];
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const px = Math.min(image.width - 1, Math.max(0, x + kx));
          const py = Math.min(image.height - 1, Math.max(0, y + ky));
          const offset = (py * image.width + px) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            window[channel]?.push(image.data[offset + channel] ?? 0);
          }
        }
      }
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const values = (window[channel] ?? []).sort((a, b) => a - b);
        data[offset + channel] = values[Math.floor(values.length / 2)] ?? 0;
      }
    }
  }
  return { width: image.width, height: image.height, data };
}

export function deshadow(image: RgbaImage): RgbaImage {
  return normalizeAgainstBackground(image, boxBlur(image, 2));
}

function normalizeAgainstBackground(image: RgbaImage, background: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const bg = Math.max(1, background.data[offset + channel] ?? 1);
      const value = ((image.data[offset + channel] ?? 0) / bg) * 255;
      data[offset + channel] = clampByte(value);
    }
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { width: image.width, height: image.height, data };
}

export function rotateClockwise(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const source = (y * image.width + x) * 4;
      const nx = y;
      const ny = image.width - 1 - x;
      const dest = (ny * image.height + nx) * 4;
      data[dest] = image.data[source] ?? 0;
      data[dest + 1] = image.data[source + 1] ?? 0;
      data[dest + 2] = image.data[source + 2] ?? 0;
      data[dest + 3] = image.data[source + 3] ?? 0;
    }
  }
  return { width: image.height, height: image.width, data };
}

export function flipHorizontal(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const source = (y * image.width + x) * 4;
      const dest = (y * image.width + (image.width - 1 - x)) * 4;
      data[dest] = image.data[source] ?? 0;
      data[dest + 1] = image.data[source + 1] ?? 0;
      data[dest + 2] = image.data[source + 2] ?? 0;
      data[dest + 3] = image.data[source + 3] ?? 0;
    }
  }
  return { width: image.width, height: image.height, data };
}

export function cropImage(image: RgbaImage, x: number, y: number, width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const sx = Math.min(image.width - 1, Math.max(0, x + col));
      const sy = Math.min(image.height - 1, Math.max(0, y + row));
      const source = (sy * image.width + sx) * 4;
      const dest = (row * width + col) * 4;
      data[dest] = image.data[source] ?? 0;
      data[dest + 1] = image.data[source + 1] ?? 0;
      data[dest + 2] = image.data[source + 2] ?? 0;
      data[dest + 3] = image.data[source + 3] ?? 0;
    }
  }
  return { width, height, data };
}

export type FilterName =
  | 'original'
  | 'magic'
  | 'blackWhite'
  | 'grayscale'
  | 'colorEnhance'
  | 'highContrast'
  | 'document'
  | 'receipt'
  | 'photo';

export function applyNamedFilter(image: RgbaImage, name: FilterName): RgbaImage {
  switch (name) {
    case 'original':
      return cloneImage(image);
    case 'magic':
      return applySaturation(applyContrast(applyWhiteBalance(image, 8), 28), 18);
    case 'blackWhite':
      return applyBlackAndWhite(applyContrast(image, 20));
    case 'grayscale':
      return applyGrayscale(image);
    case 'colorEnhance':
      return applySaturation(applyContrast(image, 12), 35);
    case 'highContrast':
      return applyContrast(image, 60);
    case 'document':
      return applyBlackAndWhite(deshadow(applyContrast(image, 25)), 170);
    case 'receipt':
      return applyBlackAndWhite(deshadow(applyContrast(applyBrightness(image, 8), 35)), 150);
    case 'photo':
      return applySaturation(applyContrast(applyBrightness(image, 4), 8), 10);
    default:
      return cloneImage(image);
  }
}

export function applyAdjustments(image: RgbaImage, adjustments: Adjustments): RgbaImage {
  let next = image;
  if (adjustments.brightness) next = applyBrightness(next, adjustments.brightness);
  if (adjustments.contrast) next = applyContrast(next, adjustments.contrast);
  if (adjustments.temperature) next = applyWhiteBalance(next, adjustments.temperature);
  if (adjustments.saturation) next = applySaturation(next, adjustments.saturation);
  if (adjustments.denoise > 0) next = adjustments.denoise > 50 ? medianDenoise(next) : boxBlur(next, 1);
  if (adjustments.sharpness) next = applySharpen(next, adjustments.sharpness);
  return next;
}
