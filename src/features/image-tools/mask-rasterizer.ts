import { zlibSync } from 'fflate';

import { isRegionInside, type Region } from '../canvas/selection';

export type MaskPoint = { x: number; y: number };
export type MaskShape =
  | { kind: 'rectangle'; region: Region }
  | { kind: 'brush'; points: readonly MaskPoint[]; radius: number };

export type MaskRasterInput = {
  width: number;
  height: number;
  shapes: readonly MaskShape[];
};

export type MaskRasterResult = {
  width: number;
  height: number;
  mimeType: 'image/png';
  pixels: Uint8Array;
  bytes: Uint8Array;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const writeUint32 = (output: Uint8Array, offset: number, value: number): void => {
  output[offset] = (value >>> 24) & 0xff;
  output[offset + 1] = (value >>> 16) & 0xff;
  output[offset + 2] = (value >>> 8) & 0xff;
  output[offset + 3] = value & 0xff;
};

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = new TextEncoder().encode(type);
  const output = new Uint8Array(12 + typeBytes.length + data.length);
  writeUint32(output, 0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  const checksumInput = new Uint8Array(typeBytes.length + data.length);
  checksumInput.set(typeBytes);
  checksumInput.set(data, typeBytes.length);
  writeUint32(output, output.length - 4, crc32(checksumInput));
  return output;
};

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const distanceSquared = (point: MaskPoint, start: MaskPoint, end: MaskPoint): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
};

const markRectangle = (pixels: Uint8Array, width: number, height: number, region: Region): void => {
  const left = Math.max(0, Math.floor(region.x));
  const top = Math.max(0, Math.floor(region.y));
  const right = Math.min(width, Math.ceil(region.x + region.width));
  const bottom = Math.min(height, Math.ceil(region.y + region.height));
  for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) pixels[y * width + x] = 255;
};

const markBrush = (pixels: Uint8Array, width: number, height: number, points: readonly MaskPoint[], radius: number): void => {
  const radiusSquared = radius * radius;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const point = { x: x + 0.5, y: y + 0.5 };
      const segmentCount = Math.max(1, points.length - 1);
      for (let index = 0; index < segmentCount; index += 1) {
        const start = points[Math.min(index, points.length - 1)]!;
        const end = points[Math.min(index + 1, points.length - 1)]!;
        if (distanceSquared(point, start, end) <= radiusSquared) {
          pixels[y * width + x] = 255;
          break;
        }
      }
    }
  }
};

const encodePng = (width: number, height: number, pixels: Uint8Array): Uint8Array => {
  const header = new Uint8Array(13);
  writeUint32(header, 0, width);
  writeUint32(header, 4, height);
  header[8] = 8; // grayscale, 8 bits per sample
  header[9] = 0; // colour type: grayscale
  const rows = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (width + 1)] = 0;
    rows.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  return concat(PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlibSync(rows)), chunk('IEND', new Uint8Array()));
};

export const rasterizeMask = (input: MaskRasterInput): MaskRasterResult => {
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width <= 0 || input.height <= 0 || input.width > 8192 || input.height > 8192) {
    throw new Error('MASK_DIMENSIONS_INVALID');
  }
  const pixels = new Uint8Array(input.width * input.height);
  for (const shape of input.shapes) {
    if (shape.kind === 'rectangle') {
      if (!isRegionInside(shape.region, { width: input.width, height: input.height })) continue;
      markRectangle(pixels, input.width, input.height, shape.region);
    } else if (shape.kind === 'brush') {
      if (!finite(shape.radius) || shape.radius <= 0 || shape.points.length === 0 || shape.points.some((point) => !finite(point.x) || !finite(point.y))) continue;
      markBrush(pixels, input.width, input.height, shape.points, shape.radius);
    }
  }
  if (!pixels.some((value) => value > 0)) throw new Error('MASK_EMPTY');
  return { width: input.width, height: input.height, mimeType: 'image/png', pixels, bytes: encodePng(input.width, input.height, pixels) };
};

export const isPngMask = (bytes: Uint8Array): boolean => bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, index) => bytes[index] === value);
