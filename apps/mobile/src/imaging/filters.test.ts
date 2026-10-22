import {
  applyBlackAndWhite,
  applyBrightness,
  applyContrast,
  applyGrayscale,
  applyNamedFilter,
  applySharpen,
  cropImage,
  flipHorizontal,
  medianDenoise,
  rotateClockwise,
  type RgbaImage,
} from './filters';

function solid(width: number, height: number, rgba: [number, number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = rgba[0];
    data[offset + 1] = rgba[1];
    data[offset + 2] = rgba[2];
    data[offset + 3] = rgba[3];
  }
  return { width, height, data };
}

describe('image filters', () => {
  it('brightens and increases contrast without mutating the source', () => {
    const source = solid(2, 2, [40, 80, 120, 255]);
    const bright = applyBrightness(source, 10);
    expect(bright.data[0]).toBeGreaterThan(source.data[0] ?? 0);
    expect(source.data[0]).toBe(40);
    const contrasted = applyContrast(solid(1, 1, [200, 200, 200, 255]), 40);
    expect(contrasted.data[0]).toBeGreaterThan(200);
  });

  it('converts to grayscale and black and white', () => {
    const gray = applyGrayscale(solid(1, 1, [255, 0, 0, 255]));
    expect(gray.data[0]).toBe(gray.data[1]);
    expect(gray.data[1]).toBe(gray.data[2]);
    const bw = applyBlackAndWhite(solid(1, 2, [10, 10, 10, 255]), 40);
    expect(bw.data[0]).toBe(0);
  });

  it('sharpens a lone bright pixel and denoises salt noise with a median', () => {
    const image = solid(3, 3, [20, 20, 20, 255]);
    image.data[(1 * 3 + 1) * 4] = 220;
    image.data[(1 * 3 + 1) * 4 + 1] = 220;
    image.data[(1 * 3 + 1) * 4 + 2] = 220;
    const sharp = applySharpen(image, 50);
    expect(sharp.data[(1 * 3 + 1) * 4]).toBeGreaterThanOrEqual(220);
    const noisy = solid(3, 3, [100, 100, 100, 255]);
    noisy.data[0] = 255;
    const clean = medianDenoise(noisy);
    expect(clean.data[0]).toBe(100);
  });

  it('rotates, flips, and crops', () => {
    const image = solid(2, 1, [1, 2, 3, 255]);
    image.data[4] = 9;
    const rotated = rotateClockwise(image);
    expect(rotated.width).toBe(1);
    expect(rotated.height).toBe(2);
    expect(rotated.data[0]).toBe(9);
    const flipped = flipHorizontal(image);
    expect(flipped.data[0]).toBe(9);
    const cropped = cropImage(solid(4, 4, [7, 7, 7, 255]), 1, 1, 2, 2);
    expect(cropped.width).toBe(2);
    expect(cropped.data[0]).toBe(7);
  });

  it('applies document and receipt presets', () => {
    const source = solid(5, 5, [180, 180, 170, 255]);
    const document = applyNamedFilter(source, 'document');
    expect(document.data[0] === 0 || document.data[0] === 255).toBe(true);
    const receipt = applyNamedFilter(source, 'receipt');
    expect(receipt.data.length).toBe(source.data.length);
  });
});
