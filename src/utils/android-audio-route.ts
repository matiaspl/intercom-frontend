import { Capacitor } from "@capacitor/core";
import {
  AudioRoute,
  type AudioRouteId,
  type AudioRouteItem,
} from "../mobile-overlay/audio-route";
import { isMobileApp } from "../platform";

const STORAGE_KEY = "audioRoute";

const ROUTE_ORDER: AudioRouteId[] = [
  "headset",
  "earpiece",
  "bluetooth",
  "speaker",
];

export const isAudioRouteAvailable = (): boolean =>
  isMobileApp() && Capacitor.isPluginAvailable("AudioRoute");

export const readStoredAudioRoute = (): AudioRouteId | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("id.audioRoute");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed === "speaker" ||
      parsed === "earpiece" ||
      parsed === "headset" ||
      parsed === "bluetooth"
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};

export const writeStoredAudioRoute = (route: AudioRouteId): void => {
  try {
    window.localStorage.setItem("id.audioRoute", JSON.stringify(route));
  } catch {
    // ignore
  }
};

export const pickDefaultAudioRoute = (
  routes: AudioRouteItem[]
): AudioRouteId | null => {
  return (
    ROUTE_ORDER.find((id) =>
      routes.some((route) => route.id === id && route.available)
    ) ??
    routes.find((route) => route.available)?.id ??
    null
  );
};

export const resolveAudioRouteToApply = (
  routes: AudioRouteItem[],
  active: AudioRouteId | null | undefined
): AudioRouteId | null => {
  const stored = readStoredAudioRoute();
  if (stored && routes.some((r) => r.id === stored && r.available)) {
    return stored;
  }
  if (active && routes.some((r) => r.id === active && r.available)) {
    return active;
  }
  return pickDefaultAudioRoute(routes);
};

export const setAndroidAudioRoute = async (
  route: AudioRouteId
): Promise<AudioRouteId | null> => {
  if (!isAudioRouteAvailable()) return null;
  try {
    const result = await AudioRoute.setRoute({ route });
    writeStoredAudioRoute(route);
    return result.active ?? route;
  } catch {
    return null;
  }
};

export const applyStoredAudioRoute = async (): Promise<AudioRouteId | null> => {
  if (!isAudioRouteAvailable()) return null;
  try {
    const { routes, active } = await AudioRoute.getAvailableRoutes();
    const route = resolveAudioRouteToApply(routes, active);
    if (!route) return null;
    return await setAndroidAudioRoute(route);
  } catch {
    return null;
  }
};

export { STORAGE_KEY as ANDROID_AUDIO_ROUTE_STORAGE_KEY };
