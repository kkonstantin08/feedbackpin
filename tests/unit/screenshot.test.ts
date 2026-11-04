import { describe, expect, it, vi } from 'vitest';
import {
  processScreenshot,
  type ScreenshotAdapter,
} from '../../src/shared/screenshot';

function adapter({
  width = 2000,
  height = 1000,
  size = 128,
  type = 'image/webp',
  blob = new Blob(['x'.repeat(size)], { type }),
}: {
  width?: number;
  height?: number;
  size?: number;
  type?: string;
  blob?: Blob;
} = {}) {
  const image = { width, height, close: vi.fn() };
  const surface = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    toBlob: vi.fn(async (): Promise<Blob | null> => blob),
  };
  const value: ScreenshotAdapter = {
    decode: vi.fn(async () => ({
      image: image as unknown as ImageBitmap,
      width,
      height,
      close: image.close,
    })),
    createCanvas: vi.fn(() => surface),
  };
  return { value, image, surface };
}

const dataUrl = 'data:image/png;base64,AAAA';
const viewport = { width: 1000, height: 500 };

describe('safe screenshot processing', () => {
  it('resizes the longest edge to 1600 and encodes WebP at quality 0.8', async () => {
    const { value, surface } = adapter();

    await expect(
      processScreenshot(dataUrl, [], viewport, value),
    ).resolves.toBeInstanceOf(Blob);
    expect(value.createCanvas).toHaveBeenCalledWith(1600, 800);
    expect(surface.toBlob).toHaveBeenCalledWith('image/webp', 0.8);
  });

  it('scales CSS viewport redactions into output pixels and clips them to the image', async () => {
    const { value, surface } = adapter();

    await processScreenshot(
      dataUrl,
      [
        { x: 10, y: 20, width: 100, height: 50 },
        { x: -10, y: 480, width: 30, height: 50 },
      ],
      viewport,
      value,
    );

    expect(surface.fillRect).toHaveBeenNthCalledWith(1, 16, 32, 160, 81);
    expect(surface.fillRect).toHaveBeenNthCalledWith(2, 0, 768, 32, 32);
  });

  it('rejects an image above 2 MiB and a canvas that did not encode WebP', async () => {
    await expect(
      processScreenshot(
        dataUrl,
        [],
        viewport,
        adapter({ size: 2 * 1024 * 1024 }).value,
      ),
    ).resolves.toBeInstanceOf(Blob);
    const tooLarge = adapter({ size: 2 * 1024 * 1024 + 1 });
    await expect(
      processScreenshot(dataUrl, [], viewport, tooLarge.value),
    ).rejects.toThrow(/2 MiB/i);

    const wrongFormat = adapter({ type: 'image/png' });
    await expect(
      processScreenshot(dataUrl, [], viewport, wrongFormat.value),
    ).rejects.toThrow(/WebP/i);
  });

  it('returns a readable failure if image decode or canvas encoding fails', async () => {
    const decodeFailure = adapter();
    vi.mocked(decodeFailure.value.decode).mockRejectedValueOnce(
      new Error('bad image'),
    );
    await expect(
      processScreenshot(dataUrl, [], viewport, decodeFailure.value),
    ).rejects.toThrow(/read the captured screenshot/i);

    const encodeFailure = adapter();
    vi.mocked(encodeFailure.surface.toBlob).mockResolvedValueOnce(null);
    await expect(
      processScreenshot(dataUrl, [], viewport, encodeFailure.value),
    ).rejects.toThrow(/encode screenshot/i);
    expect(encodeFailure.image.close).toHaveBeenCalledOnce();
  });
});
