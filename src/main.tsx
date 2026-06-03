import { Capacitor } from "@capacitor/core";

const platform = import.meta.env.VITE_MOBILE_TARGET || Capacitor.getPlatform?.();

if (platform === "ios") {
  void import("./main.ios.tsx");
} else if (platform === "android") {
  void import("./main.android.tsx");
} else {
  void import("./main.web.tsx");
}
