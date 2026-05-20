/**
 * Pure decision function for the hybrid managed PWA update flow.
 *
 * Returns `true` only when all 4 safety guards pass — see sk-pwa §3.2.
 * Any thrown error or guard miss collapses to `false` (caller falls back
 * to the visible update toast). Inputs are injected so the guards can be
 * unit-tested without touching `performance`, `Date`, or the SW.
 */

export interface SafetyContext {
  /** Reads `performance.getEntriesByType('navigation')[0].type`. */
  getNavType: () => string | undefined;
  /** Reads the current epoch ms (typically `Date.now`). */
  now: () => number;
  /** Epoch ms captured at component mount. */
  mountedAt: number;
  /** `true` once any tracked interaction event has fired. */
  userInteracted: boolean;
  /** Resolves to the number of window clients in this SW scope. */
  countClients: () => Promise<number>;
}

export const RECENTLY_MOUNTED_MS = 5_000;

export async function evaluateAutoUpdateSafety(ctx: SafetyContext): Promise<boolean> {
  try {
    if (ctx.getNavType() !== 'navigate') return false;
    if (ctx.now() - ctx.mountedAt >= RECENTLY_MOUNTED_MS) return false;
    if (ctx.userInteracted) return false;
    const count = await ctx.countClients();
    if (count !== 1) return false;
    return true;
  } catch {
    return false;
  }
}
