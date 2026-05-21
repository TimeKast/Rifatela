import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock @vercel/blob ----------------------------------------------------
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
}));

// --- Import after mock ----------------------------------------------------
const { uploadPrizeImage, PrizeImageUploadError, MAX_PRIZE_IMAGE_BYTES } =
  await import('./prize-upload');

// --- Helpers --------------------------------------------------------------
/**
 * Build a File-like object with controllable type + size without allocating
 * megabytes of buffer. `size` is set independently from the byte content so
 * we can simulate "too large" without holding 6MB in memory.
 */
function fakeFile({
  type,
  size,
  name = 'prize.bin',
}: {
  type: string;
  size: number;
  name?: string;
}): File {
  // Start with a 1-byte File then override its `size` getter so we can
  // simulate arbitrary file sizes (incl. > 5 MB) without allocating buffers.
  const file = new File([new Uint8Array([0])], name, { type });
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

beforeEach(() => {
  mockPut.mockReset();
});

describe('uploadPrizeImage', () => {
  it('uploads a valid JPEG and returns the public URL', async () => {
    mockPut.mockResolvedValueOnce({ url: 'https://blob.vercel.com/prizes/r1-abc.jpg' });

    const file = fakeFile({ type: 'image/jpeg', size: 100_000 });
    const result = await uploadPrizeImage(file, 'r1');

    expect(result).toEqual({ url: 'https://blob.vercel.com/prizes/r1-abc.jpg' });
    expect(mockPut).toHaveBeenCalledOnce();

    const [filename, sentFile, options] = mockPut.mock.calls[0]!;
    expect(filename).toMatch(/^prizes\/r1-[A-Za-z0-9_-]{8}\.jpg$/);
    expect(sentFile).toBe(file);
    expect(options).toEqual({ access: 'public' });
  });

  it('uses .png extension for PNG files', async () => {
    mockPut.mockResolvedValueOnce({ url: 'https://blob/x.png' });
    await uploadPrizeImage(fakeFile({ type: 'image/png', size: 50_000 }), 'rXYZ');
    const filename = mockPut.mock.calls[0]![0] as string;
    expect(filename).toMatch(/^prizes\/rXYZ-[A-Za-z0-9_-]{8}\.png$/);
  });

  it('uses .webp extension for WebP files', async () => {
    mockPut.mockResolvedValueOnce({ url: 'https://blob/x.webp' });
    await uploadPrizeImage(fakeFile({ type: 'image/webp', size: 50_000 }), 'r9');
    const filename = mockPut.mock.calls[0]![0] as string;
    expect(filename).toMatch(/^prizes\/r9-[A-Za-z0-9_-]{8}\.webp$/);
  });

  it('throws invalid_image_type for SVG (anti-XSS guard) and does NOT call put()', async () => {
    const file = fakeFile({ type: 'image/svg+xml', size: 1000 });
    await expect(uploadPrizeImage(file, 'r1')).rejects.toMatchObject({
      name: 'PrizeImageUploadError',
      code: 'invalid_image_type',
    });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('throws invalid_image_type for PDF and does NOT call put()', async () => {
    const file = fakeFile({ type: 'application/pdf', size: 1000 });
    await expect(uploadPrizeImage(file, 'r1')).rejects.toBeInstanceOf(PrizeImageUploadError);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('throws image_too_large at exactly MAX+1 bytes', async () => {
    const file = fakeFile({ type: 'image/jpeg', size: MAX_PRIZE_IMAGE_BYTES + 1 });
    await expect(uploadPrizeImage(file, 'r1')).rejects.toMatchObject({
      code: 'image_too_large',
    });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('accepts a file at exactly MAX bytes (boundary)', async () => {
    mockPut.mockResolvedValueOnce({ url: 'https://blob/edge.jpg' });
    const file = fakeFile({ type: 'image/jpeg', size: MAX_PRIZE_IMAGE_BYTES });
    await expect(uploadPrizeImage(file, 'r1')).resolves.toEqual({
      url: 'https://blob/edge.jpg',
    });
  });

  it('ignores user-supplied filename — derives a safe one from raffleId + nanoid', async () => {
    mockPut.mockResolvedValueOnce({ url: 'https://blob/safe.jpg' });
    const malicious = fakeFile({
      type: 'image/jpeg',
      size: 1000,
      name: '../../../etc/passwd.jpg',
    });
    await uploadPrizeImage(malicious, 'r-test');
    const filename = mockPut.mock.calls[0]![0] as string;
    expect(filename).not.toContain('..');
    expect(filename).not.toContain('passwd');
    expect(filename).toMatch(/^prizes\/r-test-[A-Za-z0-9_-]{8}\.jpg$/);
  });

  it('wraps upstream put() errors as PrizeImageUploadError("upload_failed")', async () => {
    // Suppress console.error from the wrapper during this test
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockPut.mockRejectedValueOnce(new Error('network timeout'));

    await expect(
      uploadPrizeImage(fakeFile({ type: 'image/jpeg', size: 1000 }), 'r1')
    ).rejects.toMatchObject({
      name: 'PrizeImageUploadError',
      code: 'upload_failed',
    });

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
