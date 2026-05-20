'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { evaluateAutoUpdateSafety } from '@/lib/pwa/evaluateAutoUpdateSafety';

/**
 * PwaUpdateToast — Hybrid managed update flow for the kit's SW.
 *
 * Behavior:
 * - On every check, if a `registration.waiting` SW exists, run the 4 safety
 *   guards (cold-nav, page mounted <5s, single tab, no user interaction).
 *   If all 4 pass → `skipWaiting` + reload silently. If any fails → show the
 *   classic "Nueva versión disponible — Recargar" toast.
 *
 * Update detection runs on 4 triggers (long-running mobile PWAs need
 * aggressive checks; the browser's default ~24h interval misses fixes
 * for sessions that never close):
 *
 *   1. Mount               — first render after the component lands.
 *   2. Pathname change     — every client-side route change.
 *   3. Visibility visible  — when the tab returns to foreground.
 *   4. Window focus        — when the window regains focus.
 *
 * Each trigger only calls `registration.update()`, which is idempotent and
 * rate-limited by the browser. If the browser finds a new SW, the
 * `updatefound` listener (attached once on mount) routes it through
 * `handleWaitingUpdate` → silent path or toast.
 *
 * See sk-pwa §3 / §3.2 for the full flow and guard rationale.
 */
export function PwaUpdateToast() {
  // Skip in dev: Turbopack regenerates the SW on every chunk reload, which
  // makes the toast appear constantly during local dev and during
  // Playwright E2E (where it intercepts pointer events on real buttons and
  // causes flaky test failures). Production builds keep the toast wired.
  if (process.env.NODE_ENV === 'development') return null;
  return <PwaUpdateToastInner />;
}

const LOOP_GUARD_KEY = 'pwa-auto-reload-in-flight';
const LOOP_GUARD_TTL_MS = 5 * 60 * 1000;
const COUNT_CLIENTS_TIMEOUT_MS = 1500;

const INTERACTION_EVENTS = [
  'pointerdown',
  'click',
  'touchstart',
  'keydown',
  'beforeinput',
  'input',
  'paste',
  'compositionstart',
] as const;

function countClientsViaSW(): Promise<number> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(Infinity);
  }
  const controller = navigator.serviceWorker.controller;
  if (!controller) return Promise.resolve(Infinity);

  return new Promise<number>((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(Infinity), COUNT_CLIENTS_TIMEOUT_MS);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      const count = (event.data as { count?: unknown } | null)?.count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
        resolve(Infinity);
        return;
      }
      resolve(count);
    };

    try {
      controller.postMessage({ type: 'COUNT_CLIENTS' }, [channel.port2]);
    } catch {
      window.clearTimeout(timeout);
      resolve(Infinity);
    }
  });
}

function PwaUpdateToastInner() {
  const pathname = usePathname();
  const toastShownRef = useRef(false);
  const handlingUpdateRef = useRef(false);
  const mountedAtRef = useRef<number>(0);
  const userInteractedRef = useRef(false);
  const installingTrackedRef = useRef<WeakSet<ServiceWorker>>(new WeakSet());

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    mountedAtRef.current = Date.now();

    const showUpdateToast = (waitingSW: ServiceWorker) => {
      if (toastShownRef.current) return;
      toastShownRef.current = true;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      toast.info('Nueva versión disponible', {
        description: 'Recarga para ver los últimos cambios.',
        action: {
          label: 'Recargar',
          onClick: () => {
            waitingSW.postMessage({ type: 'SKIP_WAITING' });
          },
        },
        duration: Infinity,
      });
    };

    const checkLoopGuard = (): boolean => {
      try {
        const raw = sessionStorage.getItem(LOOP_GUARD_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { startedAt?: number };
        const startedAt = parsed?.startedAt;
        if (typeof startedAt !== 'number') {
          sessionStorage.removeItem(LOOP_GUARD_KEY);
          return false;
        }
        if (Date.now() - startedAt >= LOOP_GUARD_TTL_MS) {
          sessionStorage.removeItem(LOOP_GUARD_KEY);
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    const handleWaitingUpdate = async (waitingSW: ServiceWorker) => {
      if (handlingUpdateRef.current || toastShownRef.current) return;
      handlingUpdateRef.current = true;

      try {
        if (checkLoopGuard()) {
          showUpdateToast(waitingSW);
          return;
        }

        const safe = await evaluateAutoUpdateSafety({
          getNavType: () => {
            const entry = performance.getEntriesByType('navigation')[0] as
              | PerformanceNavigationTiming
              | undefined;
            return entry?.type;
          },
          now: () => Date.now(),
          mountedAt: mountedAtRef.current,
          userInteracted: userInteractedRef.current,
          countClients: countClientsViaSW,
        });

        if (!safe) {
          showUpdateToast(waitingSW);
          return;
        }

        try {
          sessionStorage.setItem(LOOP_GUARD_KEY, JSON.stringify({ startedAt: Date.now() }));
        } catch {
          // best-effort; if storage is unavailable, proceed without guard
        }

        // Engancha `controllerchange` ANTES del `postMessage` para evitar
        // race condition con un SW que se activa rapidísimo.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });

        waitingSW.postMessage({ type: 'SKIP_WAITING' });
      } catch (err) {
        console.error('[PwaUpdateToast] handleWaitingUpdate failed:', err);
        showUpdateToast(waitingSW);
      } finally {
        handlingUpdateRef.current = false;
      }
    };

    const trackInstalling = (
      installing: ServiceWorker,
      registration: ServiceWorkerRegistration
    ) => {
      if (installingTrackedRef.current.has(installing)) return;
      installingTrackedRef.current.add(installing);
      installing.addEventListener('statechange', (e) => {
        const sw = e.target as ServiceWorker;
        if (sw.state === 'installed' && registration.waiting) {
          void handleWaitingUpdate(registration.waiting);
        }
      });
    };

    const cleanupLoopGuard = async () => {
      try {
        const raw = sessionStorage.getItem(LOOP_GUARD_KEY);
        if (!raw) return;
        const registration = await navigator.serviceWorker.ready;
        if (!registration.waiting) {
          sessionStorage.removeItem(LOOP_GUARD_KEY);
        }
      } catch {
        // best-effort
      }
    };

    const setupAndCheck = async () => {
      try {
        if (!navigator.serviceWorker.controller) return;
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          trackInstalling(installing, registration);
        });

        if (registration.waiting) {
          void handleWaitingUpdate(registration.waiting);
          return;
        }

        if (registration.installing) {
          trackInstalling(registration.installing, registration);
        }
        // The pathname-dep useEffect below fires the initial `update()` on
        // mount (it runs once with the initial pathname value), so we don't
        // duplicate it here — that would double-call browser-rate-limited
        // update() and confuse tests counting invocations.
      } catch (err) {
        console.error('[PwaUpdateToast] setupAndCheck failed:', err);
      }
    };

    const interactionHandlers: Array<{ event: string; handler: EventListener }> = [];
    for (const eventName of INTERACTION_EVENTS) {
      const handler: EventListener = () => {
        userInteractedRef.current = true;
        window.removeEventListener(eventName, handler, true);
      };
      window.addEventListener(eventName, handler, true);
      interactionHandlers.push({ event: eventName, handler });
    }

    void cleanupLoopGuard();
    void setupAndCheck();

    return () => {
      for (const { event, handler } of interactionHandlers) {
        window.removeEventListener(event, handler, true);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!navigator.serviceWorker.controller) return;

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        reg?.update().catch((err) => {
          console.error('[PwaUpdateToast] update() failed on pathname change:', err);
        });
      })
      .catch((err) => {
        console.error('[PwaUpdateToast] getRegistration() failed:', err);
      });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const triggerUpdate = async () => {
      if (!navigator.serviceWorker.controller) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      } catch (err) {
        console.error('[PwaUpdateToast] update() failed on lifecycle event:', err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void triggerUpdate();
    };
    const onFocus = () => void triggerUpdate();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
