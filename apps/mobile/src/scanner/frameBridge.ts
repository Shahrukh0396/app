type FrameListener = (samples: number[], width: number, height: number) => void;

let listener: FrameListener | null = null;

export function setFrameListener(next: FrameListener | null): void {
  listener = next;
}

export function emitFrameSamples(samples: number[], width: number, height: number): void {
  listener?.(samples, width, height);
}
