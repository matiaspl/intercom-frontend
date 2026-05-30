import { useEffect } from "react";
import { AudioRoute } from "../../mobile-overlay/audio-route";
import { isMobileApp } from "../../platform";
import {
  applyStoredAudioRoute,
  isAudioRouteAvailable,
  writeStoredAudioRoute,
} from "../../utils/android-audio-route";

/** Keeps WebRTC playback on the user-selected Android communication device. */
export const AudioRouteManager = () => {
  useEffect(() => {
    if (!isMobileApp() || !isAudioRouteAvailable()) return undefined;

    applyStoredAudioRoute();

    const listenerPromise = AudioRoute.addListener(
      "audioRouteChanged",
      ({ active }) => {
        if (active) writeStoredAudioRoute(active);
      }
    );

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return null;
};
