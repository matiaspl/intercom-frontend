import { useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useGlobalState } from "../../global-state/context-provider";
import { OverlayBubble } from "../../mobile-overlay/bubble";
import { getCallHandlers } from "../../mobile-overlay/action-handlers";
import {
  buildOverlayRowState,
  resolveCallIdAtIndex,
} from "../../mobile-overlay/overlay-call-state";
import { setOverlaySyncListener } from "../../mobile-overlay/production-line-bridge";
import { isMobileApp } from "../../platform";

const SYNC_DEBOUNCE_MS = 150;

export const BubbleActionHandler = () => {
  const [state] = useGlobalState();
  const callsRef = useRef(state.calls);
  callsRef.current = state.calls;

  const pttHeldCountRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushOverlayState = useCallback(async () => {
    try {
      if (!Capacitor.isPluginAvailable("OverlayBubble")) return;
      if (pttHeldCountRef.current > 0) return;
      const running = await OverlayBubble.isRunning();
      if (!running?.running) return;
      const calls = callsRef.current || {};
      const { latch, listen, micAllowed, ids } = buildOverlayRowState(
        calls as Record<string, any>
      );
      await OverlayBubble.setCallRows({
        count: ids.length,
        latch,
        listen,
        micAllowed,
      });
    } catch (_) {
      // ignore overlay sync errors
    }
  }, []);

  const scheduleOverlaySync = useCallback(() => {
    if (pttHeldCountRef.current > 0) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      void pushOverlayState();
    }, SYNC_DEBOUNCE_MS);
  }, [pushOverlayState]);

  useEffect(() => {
    if (!isMobileApp()) return undefined;
    setOverlaySyncListener(scheduleOverlaySync);
    return () => {
      setOverlaySyncListener(null);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [scheduleOverlaySync]);

  useEffect(() => {
    if (!isMobileApp()) return;
    if (!Capacitor.isPluginAvailable("OverlayBubble")) return;

    const handleAction = async (e: { action?: string; index?: number }) => {
      const action = e?.action;
      const index = e?.index;
      if (!action) return;

      const calls = callsRef.current || {};

      if (action === "listen") {
        const targetId = resolveCallIdAtIndex(calls, index);
        if (targetId) {
          getCallHandlers(targetId)?.toggle_output_mute?.();
        } else {
          Object.keys(calls)
            .sort()
            .forEach((id) => getCallHandlers(id)?.toggle_output_mute?.());
        }
        scheduleOverlaySync();
        return;
      }

      if (action === "talk_latch") {
        const targetId = resolveCallIdAtIndex(calls, index);
        if (targetId) {
          getCallHandlers(targetId)?.toggle_input_mute?.();
        } else {
          Object.keys(calls)
            .sort()
            .forEach((id) => getCallHandlers(id)?.toggle_input_mute?.());
        }
        scheduleOverlaySync();
        return;
      }

      if (action === "ptt_down" || action === "ptt_up") {
        const targetId = resolveCallIdAtIndex(calls, index);
        const press = action === "ptt_down";
        const invoke = (id: string) => {
          const h = getCallHandlers(id);
          if (!h) return;
          if (press) h.push_to_talk_start?.();
          else h.push_to_talk_stop?.();
        };
        if (press) {
          pttHeldCountRef.current += 1;
        } else {
          pttHeldCountRef.current = Math.max(0, pttHeldCountRef.current - 1);
        }
        if (targetId) {
          invoke(targetId);
        } else {
          Object.keys(calls).sort().forEach(invoke);
        }
        if (!press && pttHeldCountRef.current === 0) {
          scheduleOverlaySync();
        }
      }
    };

    const subPromise = OverlayBubble.addListener("bubbleAction", handleAction);
    let sub: { remove: () => void } | null = null;
    subPromise.then((h) => {
      sub = h;
    });
    return () => {
      if (sub && typeof sub.remove === "function") sub.remove();
    };
  }, [scheduleOverlaySync]);

  useEffect(() => {
    if (!isMobileApp()) return;
    const onVis = async () => {
      try {
        if (!Capacitor.isPluginAvailable("OverlayBubble")) return;
        const granted = await OverlayBubble.canDrawOverlays();
        const hasCalls = Object.keys(callsRef.current || {}).length > 0;
        if (document.hidden && hasCalls) {
          if (!granted.granted) {
            await OverlayBubble.openOverlayPermission();
          } else {
            await OverlayBubble.show();
            await pushOverlayState();
          }
        } else {
          await OverlayBubble.hide();
        }
      } catch (_) {
        // ignore
      }
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [state.calls, pushOverlayState]);

  useEffect(() => {
    if (!isMobileApp()) return;
    if (document.hidden) {
      scheduleOverlaySync();
    }
  }, [state.calls, scheduleOverlaySync]);

  return null;
};
