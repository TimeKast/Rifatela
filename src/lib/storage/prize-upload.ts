/**
 * Prize Image Upload (Vercel Blob)
 *
 * Uploads the prize image for a raffle to Vercel Blob with strict MIME
 * and size validation. Defends against RSK-004 (malicious image upload):
 *   - MIME allow-list (jpeg/png/webp only — no SVG, no polyglots).
 *   - Hard size cap (5 MB).
 *   - Server-derived filename — ignores the user-supplied name entirely.
 *
 * Requires `BLOB_READ_WRITE_TOKEN` env var (auto-provided by Vercel when a
 * Blob store is attached; on Railway/other hosts, configure manually).
 *
 * @see project/planning/13_RISK_REGISTER.md (RSK-004)
 * @see project/planning/08_API_CONTRACTS.md (Image upload section)
 * @see project/backlog/epics/EPIC-001-foundation-data-layer/issues/RIF-005-vercel-blob-upload.md
 */

import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';

/** Allowed MIME types — keep tight. Add to this set with a security review. */
const ALLOWED_MIMES = new Set<string>(['image/jpeg', 'image/png', 'image/webp']);

/** Hard size cap (5 MB). Prevents Blob storage abuse + bloated uploads. */
export const MAX_PRIZE_IMAGE_BYTES = 5 * 1024 * 1024;

/** Filename extension per MIME — controlled mapping (no inference from user input). */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Structured upload error. Server actions catch this and translate the
 * `.code` to a user-facing message in their preferred locale.
 *
 * Possible codes:
 *   - `invalid_image_type` — MIME not in the allow-list.
 *   - `image_too_large`    — File exceeds MAX_PRIZE_IMAGE_BYTES.
 *   - `upload_failed`      — Vercel Blob put() threw (network, quota, etc.).
 */
export class PrizeImageUploadError extends Error {
  constructor(public readonly code: 'invalid_image_type' | 'image_too_large' | 'upload_failed') {
    super(code);
    this.name = 'PrizeImageUploadError';
  }
}

/**
 * Upload a prize image to Vercel Blob. Returns the public URL.
 *
 * Filename pattern: `prizes/{raffleId}-{nanoid(8)}.{ext}` — derived entirely
 * server-side. `file.name` is ignored to defend against path traversal,
 * unicode tricks, and other filename-based attacks.
 *
 * @throws PrizeImageUploadError with structured code on validation failure
 *         or upstream put() error.
 */
export async function uploadPrizeImage(file: File, raffleId: string): Promise<{ url: string }> {
  if (!ALLOWED_MIMES.has(file.type)) {
    throw new PrizeImageUploadError('invalid_image_type');
  }
  if (file.size > MAX_PRIZE_IMAGE_BYTES) {
    throw new PrizeImageUploadError('image_too_large');
  }

  const ext = EXT_BY_MIME[file.type];
  const filename = `prizes/${raffleId}-${nanoid(8)}.${ext}`;

  try {
    const blob = await put(filename, file, { access: 'public' });
    return { url: blob.url };
  } catch (cause) {
    // Wrap upstream errors so callers don't depend on @vercel/blob's error
    // surface. Log original for observability (Sentry will pick it up via
    // the unhandled-rejection path if the action doesn't catch).
    console.error('[uploadPrizeImage] vercel blob put() failed', cause);
    throw new PrizeImageUploadError('upload_failed');
  }
}
