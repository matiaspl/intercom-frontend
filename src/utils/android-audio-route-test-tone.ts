import { AudioRoute } from "../mobile-overlay/audio-route";
import { isAudioRouteAvailable, readStoredAudioRoute } from "./android-audio-route";

export const playAndroidAudioRouteTestTone = async (): Promise<boolean> => {
  if (!isAudioRouteAvailable() || !AudioRoute.playTestTone) return false;
  try {
    await AudioRoute.playTestTone({
      durationMs: 5000,
      frequencyHz: 440,
      route: readStoredAudioRoute() ?? "speaker",
    });
    return true;
  } catch {
    return false;
  }
};

export const stopAndroidAudioRouteTestTone = async (): Promise<void> => {
  if (!isAudioRouteAvailable() || !AudioRoute.stopTestTone) return;
  try {
    await AudioRoute.stopTestTone();
  } catch {
    // ignore
  }
};
