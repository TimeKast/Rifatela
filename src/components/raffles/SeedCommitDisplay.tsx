/**
 * SeedCommitDisplay + CommitRevealBadge — CMP-010 / CMP-013 (RIF-025)
 *
 * Displays the `seed_commit` (sha256 hex) that backs the commit-reveal
 * scheme (BR-006). Truncated by default (`a3f8b9c4…e6f7a8b9`) with a
 * click-to-expand and a copy button that yanks the full 64-char hash.
 *
 * Sibling `<CommitRevealBadge>` is a small chip explaining "Sorteo
 * verificable" — both meant to live in the public landing footer.
 *
 * Both are client components because they need state (expand toggle +
 * clipboard write). The badge is intentionally tiny: an icon + label;
 * the explanatory link goes to a separate screen (RIF-028 SCR-010 verify).
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-006 commit-reveal)
 * @see project/planning/15_DESIGN.md CMP-010, CMP-013
 */

'use client';

import { useState } from 'react';

interface SeedCommitDisplayProps {
  /** 64-char hex string (sha256). */
  value: string;
}

export function SeedCommitDisplay({ value }: SeedCommitDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const truncated = value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unsupported — silent fallback. The expanded hash is
      // still selectable in the DOM so the user can copy manually.
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Ocultar' : 'Ver hash completo'}
        className="focus-ring bg-muted text-foreground hover:bg-muted/80 inline-flex items-center rounded-md px-2 py-1 font-mono text-xs transition-colors"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {expanded ? value : truncated}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="focus-ring text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-xs transition-colors"
        aria-label="Copiar hash"
      >
        {copied ? '¡Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}

export function CommitRevealBadge() {
  return (
    <span
      className="bg-success/15 text-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      title="El sorteo se ejecuta con un seed cuya huella sha256 ya está publicada — cualquiera puede verificar que no se cambió después."
    >
      <span aria-hidden>🔒</span>
      Sorteo verificable
    </span>
  );
}
