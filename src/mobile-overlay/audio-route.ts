import { PluginListenerHandle, registerPlugin } from "@capacitor/core";

export type AudioRouteId = string;

export interface AudioRouteItem {
  id: AudioRouteId;
  label: string;
  available: boolean;
  type?: string;
}

export interface GetRoutesResult {
  routes: AudioRouteItem[];
  active?: AudioRouteId | null;
}

export interface SetRouteResult {
  active?: AudioRouteId | null;
}

export interface AudioRoutePlugin {
  getAvailableRoutes(): Promise<GetRoutesResult>;
  setRoute(options: { route: AudioRouteId }): Promise<SetRouteResult>;
  playTestTone?(options?: {
    durationMs?: number;
    frequencyHz?: number;
  }): Promise<void>;
  stopTestTone?(): Promise<void>;
  requestBluetoothPermission?(): Promise<void>;
  hasBluetoothPermission?(): Promise<{ granted: boolean }>;
  addListener(
    eventName: "audioRouteChanged",
    listenerFunc: (state: GetRoutesResult) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export const AudioRoute = registerPlugin<AudioRoutePlugin>("AudioRoute");
