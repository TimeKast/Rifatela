import { describe, it, expect } from 'vitest';
import { evaluateAutoUpdateSafety, type SafetyContext } from '@/lib/pwa/evaluateAutoUpdateSafety';

function makeContext(overrides: Partial<SafetyContext> = {}): SafetyContext {
  return {
    getNavType: () => 'navigate',
    now: () => 1_000,
    mountedAt: 0,
    userInteracted: false,
    countClients: () => Promise.resolve(1),
    ...overrides,
  };
}

describe('evaluateAutoUpdateSafety', () => {
  it('returns true when all 4 guards pass (happy path)', async () => {
    await expect(evaluateAutoUpdateSafety(makeContext())).resolves.toBe(true);
  });

  it('guard 1 — fails when navigation type is reload', async () => {
    const ctx = makeContext({ getNavType: () => 'reload' });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('guard 1 — fails when navigation type is back_forward', async () => {
    const ctx = makeContext({ getNavType: () => 'back_forward' });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('guard 1 — fails when no navigation entry exists (undefined)', async () => {
    const ctx = makeContext({ getNavType: () => undefined });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('guard 2 — fails when page mounted >= 5s ago', async () => {
    const ctx = makeContext({ now: () => 6_000, mountedAt: 0 });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('guard 2 — boundary: 4999ms passes, 5000ms fails', async () => {
    const just = makeContext({ now: () => 4_999, mountedAt: 0 });
    const over = makeContext({ now: () => 5_000, mountedAt: 0 });
    await expect(evaluateAutoUpdateSafety(just)).resolves.toBe(true);
    await expect(evaluateAutoUpdateSafety(over)).resolves.toBe(false);
  });

  it('guard 3 — fails when there are 2 tabs', async () => {
    const ctx = makeContext({ countClients: () => Promise.resolve(2) });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('guard 3 — fails when count is Infinity (timeout fallback)', async () => {
    const ctx = makeContext({ countClients: () => Promise.resolve(Infinity) });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('guard 3 — fails when count is 0 (no clients somehow)', async () => {
    const ctx = makeContext({ countClients: () => Promise.resolve(0) });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('guard 4 — fails when user has interacted', async () => {
    const ctx = makeContext({ userInteracted: true });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('collapses to false when countClients rejects', async () => {
    const ctx = makeContext({
      countClients: () => Promise.reject(new Error('boom')),
    });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });

  it('collapses to false when getNavType throws', async () => {
    const ctx = makeContext({
      getNavType: () => {
        throw new Error('no performance API');
      },
    });
    await expect(evaluateAutoUpdateSafety(ctx)).resolves.toBe(false);
  });
});
