/**
 * Countdown — CMP-003 (RIF-024)
 *
 * Live countdown toward a target date. Client component because it must
 * tick once per second. The server renders an initial snapshot (computed
 * from the page render time) and the client re-syncs on mount, so the
 * first paint already shows a number — no "00:00:00" flash.
 *
 * Formats:
 *   - ≥ 24h remaining → "Xd Yh Zm"
 *   - < 24h           → "HH:MM:SS"
 *   - drawDate passed → "¡Hora del sorteo!"
 *
 * @see project/planning/15_DESIGN.md CMP-003
 */

'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  /** Target instant (UTC). */
  targetDate: Date;
  /** Server-rendered "now" — keeps the SSR snapshot in sync with the page. */
  serverNow: Date;
}

interface Parts {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffParts(target: number, now: number): Parts {
  const ms = target - now;
  if (ms <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { expired: false, days, hours, minutes, seconds };
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatParts(parts: Parts): string {
  if (parts.expired) return '¡Hora del sorteo!';
  if (parts.days > 0) {
    return `${parts.days}d ${parts.hours}h ${parts.minutes}m`;
  }
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

export function Countdown({ targetDate, serverNow }: CountdownProps) {
  const targetMs = targetDate.getTime();

  // SSR snapshot. Re-computed on every server render so the initial paint
  // is never stale by more than the request roundtrip.
  const [parts, setParts] = useState<Parts>(() => diffParts(targetMs, serverNow.getTime()));

  useEffect(() => {
    // Tick every second. First tick fires after 1s — until then the SSR
    // snapshot stands, which is accurate to the request roundtrip (<1s).
    const id = setInterval(() => {
      setParts(diffParts(targetMs, Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return (
    <div
      role="timer"
      aria-live="off"
      className="inline-flex items-baseline gap-2 font-mono text-2xl tracking-tight sm:text-3xl"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      <span className={parts.expired ? 'text-primary font-semibold' : 'text-foreground'}>
        {formatParts(parts)}
      </span>
    </div>
  );
}
