import { registerPlugin } from "@capacitor/core";

export interface AppControlPlugin {
  stopServices(): Promise<void>;
  exitApp(): Promise<void>;
  getBuildInfo(): Promise<{ debuggable: boolean }>;
}

export const AppControl = registerPlugin<AppControlPlugin>("AppControl");
