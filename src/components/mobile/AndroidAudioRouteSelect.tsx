import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AudioRoute,
  type AudioRouteId,
} from "../../mobile-overlay/audio-route";
import { FormSelect } from "../form-elements/form-elements";
import { FormItem } from "../user-settings-form/form-item";
import {
  isAudioRouteAvailable,
  resolveAudioRouteToApply,
  setAndroidAudioRoute,
  writeStoredAudioRoute,
} from "../../utils/android-audio-route";

export const AndroidAudioRouteSelect = ({
  label = "Speaker output",
  trailingAction,
}: {
  label?: string;
  trailingAction?: ReactNode;
}) => {
  const [routes, setRoutes] = useState<
    { id: AudioRouteId; label: string; available: boolean }[]
  >([]);
  const [selected, setSelected] = useState<AudioRouteId | "">("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAudioRouteAvailable()) return;
    const { routes: available, active } = await AudioRoute.getAvailableRoutes();
    setRoutes(available);
    const resolved = resolveAudioRouteToApply(available, active);
    if (resolved) {
      setSelected(resolved);
      if (resolved !== active) {
        await setAndroidAudioRoute(resolved);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!isAudioRouteAvailable()) return undefined;

    const listenerPromise = AudioRoute.addListener(
      "audioRouteChanged",
      (payload) => {
        setRoutes(payload.routes);
        const next = resolveAudioRouteToApply(payload.routes, payload.active);
        if (next) setSelected(next);
      }
    );

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [refresh]);

  if (!isAudioRouteAvailable()) {
    if (!trailingAction) return null;
    return (
      <FormItem label={label}>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0, opacity: 0.85 }}>
            Not available
          </div>
          {trailingAction}
        </div>
      </FormItem>
    );
  }

  const selectable = routes.filter((r) => r.available);

  return (
    <FormItem label={label}>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FormSelect
            value={selected}
            onChange={async (e) => {
              const route = e.target.value as AudioRouteId;
              if (!route || route === selected) return;
              setBusy(true);
              setSelected(route);
              writeStoredAudioRoute(route);
              try {
                await setAndroidAudioRoute(route);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || selectable.length === 0}
          >
            {selectable.length === 0 ? (
              <option value="">No routes available</option>
            ) : (
              selectable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))
            )}
          </FormSelect>
        </div>
        {trailingAction}
      </div>
    </FormItem>
  );
};
