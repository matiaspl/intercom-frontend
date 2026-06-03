import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/error-boundary.tsx";
import { MobileShell } from "./components/mobile/MobileShell.tsx";
import { bootstrapMobile } from "./mobile-overlay/bootstrap.ts";
import { OverlayBubble } from "./mobile-overlay/bubble.ts";
import { Capacitor } from "@capacitor/core";
import "./index.css";

bootstrapMobile();

void OverlayBubble.recordDebugState({
  reason: "main-ios",
  platform: Capacitor.getPlatform?.() || "unknown",
  callCount: 0,
  hasCalls: false,
  documentHidden: document.hidden,
  documentHasFocus: document.hasFocus(),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MobileShell>
        <App />
      </MobileShell>
    </ErrorBoundary>
  </React.StrictMode>
);
