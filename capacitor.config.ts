import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.eyevinn.intercom",
  appName: "Intercom",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "intercom",
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
