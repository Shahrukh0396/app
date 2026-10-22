import { scheduleOnRN } from 'react-native-worklets';
import type { Frame } from 'react-native-vision-camera';
import { emitFrameSamples } from './frameBridge';
import { downsampleLuma } from './framePixels';

export function handleCameraFrame(frame: Frame): void {
  'worklet';
  try {
    if (!frame.isValid || !frame.hasPixelBuffer) return;
    if (frame.isPlanar) {
      const plane = frame.getPlanes()[0];
      if (!plane?.isValid) return;
      const raw = new Uint8Array(plane.getPixelBuffer());
      const sample = downsampleLuma(raw, plane.width, plane.height, plane.bytesPerRow, 1, 160);
      scheduleOnRN(emitFrameSamples, Array.from(sample.pixels), sample.width, sample.height);
      return;
    }
    const channels: 1 | 4 = frame.bytesPerRow >= frame.width * 4 ? 4 : 1;
    const raw = new Uint8Array(frame.getPixelBuffer());
    const sample = downsampleLuma(
      raw,
      frame.width,
      frame.height,
      Math.max(frame.bytesPerRow, frame.width * channels),
      channels,
      160,
    );
    scheduleOnRN(emitFrameSamples, Array.from(sample.pixels), sample.width, sample.height);
  } finally {
    frame.dispose();
  }
}
