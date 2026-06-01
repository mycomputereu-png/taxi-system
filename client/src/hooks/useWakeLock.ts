import * as React from "react";

/**
 * Keeps the device screen awake (Screen Wake Lock API) while `active` is true
 * and the page is visible/focused. The lock is automatically released when the
 * app is backgrounded, minimized, or the phone is locked (via the
 * `visibilitychange` event) so it does not drain the battery, and re-acquired
 * when the app returns to the foreground.
 *
 * Degrades silently on browsers without Wake Lock support (e.g. older iOS Safari).
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = React.useRef<WakeLockSentinel | null>(null);

  React.useEffect(() => {
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    }).wakeLock;

    if (!active || !wakeLock) return;

    let cancelled = false;

    const release = async () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) {
        try {
          await sentinel.release();
        } catch {
          /* ignore */
        }
      }
    };

    const acquire = async () => {
      // Only hold the lock while the page is actually visible.
      if (cancelled || document.visibilityState !== "visible") return;
      if (sentinelRef.current) return;
      try {
        const sentinel = await wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        // The browser auto-releases the sentinel when the page is hidden;
        // clear our ref so we re-request on return to foreground.
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        /* request can reject if not visible / not allowed — ignore */
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        acquire();
      } else {
        release();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [active]);
}
