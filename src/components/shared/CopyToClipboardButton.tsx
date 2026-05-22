'use client';

/**
 * CopyToClipboardButton — small reusable client component.
 *
 * Used by the admin raffle detail page (copy public URL) and will be
 * reused in seller management (copy seller URL) and the ticket digital
 * page (copy share link). Inline JS-only — no library overhead.
 *
 * Falls back silently if `navigator.clipboard` is unavailable (older
 * browsers, file:// contexts). The button label briefly switches to
 * "Copiado" on success.
 */

import { useState } from 'react';

interface Props {
  value: string;
  /** Default: "Copiar". Override for context (e.g. "Copiar URL"). */
  label?: string;
  /** Default: "Copiado". Brief confirmation after a successful copy. */
  copiedLabel?: string;
  /** Optional extra Tailwind classes for the button. */
  className?: string;
}

const RESET_AFTER_MS = 2000;

export function CopyToClipboardButton({
  value,
  label = 'Copiar',
  copiedLabel = 'Copiado',
  className = '',
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Reset state so the user can copy again if they want.
      setTimeout(() => setCopied(false), RESET_AFTER_MS);
    } catch {
      // Permission denied / not in secure context — fail silently. The
      // value is still visible next to the button so the user can copy
      // manually if needed.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`focus-ring inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors ${
        copied
          ? 'bg-success border-success text-success-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted'
      } ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
