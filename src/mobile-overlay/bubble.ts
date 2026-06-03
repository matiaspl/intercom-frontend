import { PluginListenerHandle, registerPlugin } from "@capacitor/core";

export interface OverlayBubblePlugin {
  canDrawOverlays(): Promise<{ granted: boolean }>;
  openOverlayPermission(): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  setCallRows(options: {
    count: number;
    ids?: string[];
    latch: boolean[];
    listen: boolean[];
    micAllowed?: boolean[];
    listenAllowed?: boolean[];
    labels?: string[];
    labelSources?: string[];
    activity?: boolean[];
  }): Promise<void>;
  isRunning(): Promise<{ running: boolean }>;
  recordDebugState(options: {
    reason: string;
    platform?: string;
    callCount?: number;
    hasCalls?: boolean;
    documentHidden?: boolean;
    documentHasFocus?: boolean;
    running?: boolean;
    ids?: string[];
    labels?: string[];
    labelSources?: string[];
    action?: string;
    index?: number;
    targetId?: string;
    handlerActions?: string[];
  }): Promise<void>;
  getDebugState?(): Promise<{
    supported: boolean;
    liveActivitiesEnabled: boolean;
    runningRequested: boolean;
    rowCount: number;
    liveActivityCount: number;
    ids?: string[];
    labels?: string[];
    displayLabels?: string[];
    labelSources?: string[];
    lastError?: string | null;
    lastRequestAt?: string | null;
    lastUpdateAt?: string | null;
    lastDebugSnapshotAt?: string | null;
    lastAction?: { action?: string; index?: number } | null;
    lastActionAt?: string | null;
    jsDebug?: {
      reason?: string;
      platform?: string;
      callCount?: number;
      hasCalls?: boolean;
      documentHidden?: boolean;
      documentHasFocus?: boolean;
      running?: boolean;
      ids?: string[];
      labels?: string[];
      labelSources?: string[];
      action?: string;
      index?: number;
      targetId?: string;
      handlerActions?: string[];
      timestamp?: string;
    } | null;
  }>;
  showTestActivity?(): Promise<void>;
  requestNotificationPermission(): Promise<void>;
  addListener(
    eventName: "bubbleAction",
    listenerFunc: (state: { action: string; index?: number; value?: boolean }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export const OverlayBubble =
  registerPlugin<OverlayBubblePlugin>("OverlayBubble");
