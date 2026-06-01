import { useCallback, useEffect } from "react";
import { isMobileApp } from "../../platform";

export const useMobileProductionLineBridge = ({
  id,
  isInputMuted,
  isOutputMuted,
  label,
}: {
  id: string;
  isInputMuted: boolean;
  isOutputMuted: boolean;
  label: string;
}) => {
  const registerMobileActionHandler = useCallback(
    (action: string, handler: () => void) => {
      if (!isMobileApp()) return;
      void import("../../mobile-overlay/production-line-bridge").then((m) =>
        m.registerHandler(id, action, handler)
      );
    },
    [id]
  );

  useEffect(() => {
    if (!isMobileApp()) return undefined;
    void import("../../mobile-overlay/production-line-bridge").then((m) => {
      m.syncCallState(id, isInputMuted, isOutputMuted);
      m.requestOverlaySync();
    });
    return undefined;
  }, [id, isInputMuted, isOutputMuted]);

  useEffect(() => {
    if (!isMobileApp()) return undefined;
    return () => {
      void import("../../mobile-overlay/production-line-bridge").then((m) =>
        m.detachCall(id)
      );
    };
  }, [id]);

  useEffect(() => {
    if (!isMobileApp() || !label) return;
    void import("../../mobile-overlay/production-line-bridge").then((m) => {
      m.setCallOverlayLabel(id, label);
      m.requestOverlaySync();
    });
  }, [id, label]);

  return { registerMobileActionHandler };
};
