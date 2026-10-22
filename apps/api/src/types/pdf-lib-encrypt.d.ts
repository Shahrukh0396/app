declare module 'pdf-lib-encrypt' {
  export function configure(pdfLib: unknown): void;
  export function lock(bytes: Uint8Array, password: string): Promise<Uint8Array>;
  export function unlockInPlace(doc: unknown, password: string): Promise<boolean>;
}
