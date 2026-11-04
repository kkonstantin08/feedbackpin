import type { Viewport } from './report';

const MAX_EDGE = 1600;
const MAX_BYTES = 2 * 1024 * 1024;
const QUALITY = 0.8;

export interface RedactionRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DecodedScreenshot {
  image: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

export interface ScreenshotCanvas {
  drawImage: (image: CanvasImageSource, width: number, height: number) => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  toBlob: (type: string, quality: number) => Promise<Blob | null>;
}

export interface ScreenshotAdapter {
  decode: (dataUrl: string) => Promise<DecodedScreenshot>;
  createCanvas: (width: number, height: number) => ScreenshotCanvas;
}

const browserAdapter: ScreenshotAdapter = {
  async decode(dataUrl) {
    const response = await fetch(dataUrl);
    const bitmap = await createImageBitmap(await response.blob());
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  },
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare the screenshot canvas.');
    return {
      drawImage: (image, outputWidth, outputHeight) =>
        context.drawImage(image, 0, 0, outputWidth, outputHeight),
      fillRect: (x, y, rectWidth, rectHeight) => {
        context.fillStyle = '#000';
        context.fillRect(x, y, rectWidth, rectHeight);
      },
      toBlob: (type, quality) =>
        new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
    };
  },
};

export async function processScreenshot(
  dataUrl: string,
  rectangles: RedactionRectangle[],
  viewport: Viewport,
  adapter: ScreenshotAdapter = browserAdapter,
): Promise<Blob> {
  if (!/^data:image\//i.test(dataUrl))
    throw new Error('Captured screenshot is not a valid image.');
  if (
    !Number.isFinite(viewport.width) ||
    viewport.width <= 0 ||
    !Number.isFinite(viewport.height) ||
    viewport.height <= 0
  ) {
    throw new Error('Screenshot viewport dimensions are invalid.');
  }

  let decoded: DecodedScreenshot;
  try {
    decoded = await adapter.decode(dataUrl);
  } catch {
    throw new Error('Could not read the captured screenshot.');
  }

  try {
    if (
      !Number.isFinite(decoded.width) ||
      decoded.width < 1 ||
      !Number.isFinite(decoded.height) ||
      decoded.height < 1
    ) {
      throw new Error('Captured screenshot has invalid dimensions.');
    }
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(decoded.width, decoded.height),
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = adapter.createCanvas(width, height);
    canvas.drawImage(decoded.image, width, height);

    for (const rectangle of rectangles) {
      if (
        ![rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(
          Number.isFinite,
        ) ||
        rectangle.width <= 0 ||
        rectangle.height <= 0
      )
        continue;
      const left = Math.max(
        0,
        Math.floor((rectangle.x / viewport.width) * width),
      );
      const top = Math.max(
        0,
        Math.floor((rectangle.y / viewport.height) * height),
      );
      const right = Math.min(
        width,
        Math.ceil(((rectangle.x + rectangle.width) / viewport.width) * width),
      );
      const bottom = Math.min(
        height,
        Math.ceil(
          ((rectangle.y + rectangle.height) / viewport.height) * height,
        ),
      );
      if (right > left && bottom > top)
        canvas.fillRect(left, top, right - left, bottom - top);
    }

    const blob = await canvas.toBlob('image/webp', QUALITY);
    if (!blob) throw new Error('Could not encode screenshot as WebP.');
    if (blob.type !== 'image/webp')
      throw new Error('WebP image encoding is not available in this browser.');
    if (blob.size > MAX_BYTES)
      throw new Error(
        'Screenshot exceeds the 2 MiB limit. Save the report without an image.',
      );
    return blob;
  } finally {
    decoded.close?.();
  }
}
