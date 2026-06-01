import { Decoder } from 'jpeg-lossless-decoder-js';

const decoder = new Decoder();

self.onmessage = (e: MessageEvent) => {
  const { id, buffer, offset, length } = e.data as {
    id: number;
    buffer: ArrayBuffer;
    offset: number;
    length: number;
  };

  try {
    const result = decoder.decompress(buffer, offset, length);
    self.postMessage({ id, result }, { transfer: [result] });
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message });
  }
};
