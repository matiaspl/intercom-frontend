import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { isAndroidApp } from "../../platform";
import { useGlobalState } from "../../global-state/context-provider";
import { CallService } from "../../mobile-overlay/call-service";

export const CallServiceManager = () => {
  const [state] = useGlobalState();

  useEffect(() => {
    if (!isAndroidApp() || !Capacitor.isPluginAvailable("CallService")) return;
    let mounted = true;
    (async () => {
      try {
        await CallService.requestNotificationPermission();
        if (mounted) await CallService.start();
      } catch (_) {}
    })();
    return () => {
      mounted = false;
      (async () => {
        try {
          await CallService.stop();
        } catch (_) {}
      })();
    };
  }, []);

  // Keep file subscribed to state to avoid tree-shaking in prod
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  state.calls;

  return null;
};
