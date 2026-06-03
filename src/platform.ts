import { Capacitor } from "@capacitor/core";

/** True only in the Capacitor Android APK (not web, not iOS). */
export const isAndroidApp = (): boolean => {
  try {
    return Capacitor.getPlatform?.() === "android";
  } catch (_) {
    return false;
  }
};

/** True only in the Capacitor iOS app (not web, not Android). */
export const isIOSApp = (): boolean => {
  try {
    return Capacitor.getPlatform?.() === "ios";
  } catch (_) {
    return false;
  }
};

/** Native Capacitor shell — Android or iOS. */
export const isMobileApp = (): boolean => isAndroidApp() || isIOSApp();
