# iOS App (Capacitor)

The iOS app wraps the same React/Vite intercom client used on the web and Android. It is a peer to the Android app described in [`android.md`](./android.md), with native plugins ported to Swift where iOS exposes equivalent APIs and stubbed where it does not.

## Differences from the web app

The iOS app uses the same React UI and API layer as the web app, but it is built with the iOS entry point (`src/main.ios.tsx`) and served inside Capacitor's `WKWebView` instead of a desktop/mobile browser tab.

Key differences:

- Mobile-only settings include Backend URL and Backend API Key fields so an installed app can be pointed at a manager instance without rebuilding.
- Speaker / earpiece / Bluetooth routing is exposed through a native audio-route selector that wraps `AVAudioSession`.
- Calls are surfaced through CallKit so the OS shows native call UI and keeps the audio session alive in the background.
- WebView remote debugging is available via Safari (Develop → device name → App).

## Differences from the Android app

| Feature | Android | iOS |
| --- | --- | --- |
| Audio routing | `AudioManager` + Bluetooth SCO | `AVAudioSession` `setPreferredInput` / `overrideOutputAudioPort` |
| Call state | Foreground service + notification (`CallService`) | CallKit (`CXProvider` / `CXCallController`) |
| Floating controls | System overlay window (`SYSTEM_ALERT_WINDOW`) | **No free-floating overlay.** iOS does not allow third-party system overlay windows, so call controls are exposed through ActivityKit Live Activities on the Lock Screen and Dynamic Island. Push-to-talk is intentionally omitted there because Live Activity controls do not provide press/release events. |
| Notifications | `POST_NOTIFICATIONS` runtime permission | `UNUserNotificationCenter` authorization request |
| App exit | `finishAndRemoveTask()` | iOS forbids programmatic exit; `exitApp()` only stops services and resigns active. |

## Implementation overview

- `capacitor.config.ts` declares `iosScheme` alongside `androidScheme`.
- `vite.config.ios.ts` swaps the web entry point to `src/main.ios.tsx`.
- `src/main.ios.tsx` mounts the same `MobileShell` + `App` tree the Android entry uses.
- `src/platform.ts` adds `isIOSApp()`; `isMobileApp()` is now `isAndroidApp() || isIOSApp()`.
- `ios/App/App/Plugins/` contains the four Swift Capacitor plugins:
  - `AudioRoutePlugin.swift` — `AVAudioSession`-backed `AudioRoute` (`getAvailableRoutes`, `setRoute`, `playTestTone`, `audioRouteChanged` listener).
  - `CallServicePlugin.swift` — CallKit-backed `CallService` (`start`, `stop`, `isRunning`, permissions).
  - `OverlayBubblePlugin.swift` — ActivityKit-backed `OverlayBubble` bridge for Live Activity controls.
  - `AppControlPlugin.swift` — exposes build-info / stop-services / exit semantics.
- Each plugin pairs the Swift class with a small `.m` file that calls the `CAP_PLUGIN(...)` macro so Capacitor discovers it via the Objective-C runtime.
- `Info.plist` declares the usage strings and `UIBackgroundModes` (`audio`, `voip`).

## Prerequisites

- Node 20 and Yarn Classic (or npm)
- Xcode 26+ with the iOS platform component installed (Xcode → Settings → Components, or `xcodebuild -downloadPlatform iOS`)
- CocoaPods (`brew install cocoapods`)
- An iPhone running iOS 26+ paired to your Mac for USB development

## Install dependencies

From `intercom-frontend`:

```
yarn
yarn add -D @capacitor/ios
```

## Configure backend for mobile builds

Same as Android — set `VITE_BACKEND_URL` / `VITE_BACKEND_API_KEY` at build time, or fill them in the in-app User Settings panel.

For local development against a manager running on your Mac, use the host's LAN IP from the iPhone (the simulator's `localhost` does map to your machine, but a physical iPhone does not). Cleartext is allowed in the bundled `Info.plist` to ease this; switch to TLS for production.

## Add iOS platform

```
yarn cap:add:ios
```

This generates `ios/` with a native Xcode project and runs `pod install`. If the web bundle isn't present yet, run `yarn build:ios` first so `cap` has something to copy into `ios/App/App/public`.

## Build, Sync, And Deploy

This repo does not use Makefiles for platform automation. iOS build and deploy workflows live in `package.json` scripts so they work the same way as the existing web and Android commands.

### Build the iOS web bundle

```
yarn build:ios
```

This runs TypeScript and Vite with `vite.config.ios.ts`, producing bundled web assets in `dist/`.

### Copy web assets into the native iOS project

```
yarn ios:copy
```

Use this after React/TypeScript/CSS changes when the native iOS project files and pods have not changed. It runs `yarn build:ios` and `cap copy ios`, updating `ios/App/App/public`.

### Sync native dependencies and Capacitor metadata

```
yarn ios:sync
```

Use this after changing Capacitor config, native plugin metadata, pods, entitlements, or any file where Capacitor should regenerate native project state. `yarn ios:build` is kept as a backwards-compatible alias for this full sync path.

### Compile the native app without installing

```
yarn ios:native:build
```

This runs:

```
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -destination 'generic/platform=iOS' build
```

Override the configuration when needed:

```
IOS_CONFIGURATION=Release yarn ios:native:build
```

Use this to verify Swift changes, Live Activity extension changes, signing, and native project wiring without restarting the app on a device.

### List connected iOS devices

```
yarn ios:devices
```

Copy the connected iPhone's value from the `Target ID` column. This is the identifier accepted by `cap run ios --target`.

### Deploy to a connected iPhone

```
IOS_TARGET=<target-id> yarn ios:deploy
```

Example:

```
IOS_TARGET=00008030-001C552101D3402E yarn ios:deploy
```

This builds the iOS web bundle, copies/syncs through Capacitor's `cap run ios` flow, builds the native app, and installs it on the selected USB-connected device. Installing restarts the app, so any active call session usually needs to be rejoined.

### Live reload on a device

```
IOS_TARGET=<target-id> yarn ios:deploy:live
```

This runs `cap run ios -l --external` against the selected iPhone. Make sure the iPhone can reach the Mac's Vite server on the local network. When switching back to bundled assets, remove any temporary dev-server config and run:

```
yarn ios:copy
```

## Open in Xcode

```
yarn ios:open
```

Then:

1. Select the **App** target → **Signing & Capabilities**.
2. Pick your **Personal Team** under "Team".
3. Change the **Bundle Identifier** to something unique on your Apple ID, e.g. `com.eyevinn.intercom.dev.<your-initials>` — Apple's free signing won't issue a profile for a bundle ID already used by someone else's paid team.
4. Plug in the iPhone, select it as the run destination, and **Run**.

### Free Apple ID caveats

- Provisioning expires every 7 days. Re-run from Xcode to refresh.
- You can have at most 3 dev-signed apps installed at once on the device.
- Background-audio and CallKit work with personal signing; Push Notifications and certain other entitlements do not.

## Permissions

The first call attempt triggers the microphone prompt; the first CallKit call asks for nothing (the user-facing surface is the system call UI). Bluetooth route changes do not require a runtime permission on iOS — the `AVAudioSession` category configured on plugin load includes `.allowBluetooth`.

If you need to re-trigger the mic prompt for testing, delete the app from the device and reinstall.

## WebRTC notes

- `WKWebView` supports `getUserMedia`/WebRTC on iOS 14.3+.
- Autoplay rules apply — calls must start in response to user interaction.
- The iOS `Info.plist` enables `NSAllowsLocalNetworking` so a `ws://` Companion endpoint on your LAN still works during dev. Production deployments should use `wss://`.

## Remote debugging

WebView remote debugging via Safari:

1. On the iPhone, Settings → Safari → Advanced → enable **Web Inspector**.
2. On the Mac, Safari → Settings → Advanced → enable **Show Develop menu**.
3. Connect the device via USB.
4. Safari → Develop → `<device name>` → **App** — DevTools opens against the WebView.

Native debugging happens in Xcode (View → Debug Area → Activate Console).

## What's intentionally missing

- **App Store / TestFlight builds.** Free signing only.
- **Floating system overlay.** iOS does not permit free-floating third-party overlays; Live Activities are used instead.
- **VoIP push (`PushKit`).** Calls do not ring while the app is fully terminated.
- **iPad-specific layouts.** The bundled iPhone layout is used.

## Troubleshooting

- *"iOS X.Y is not installed"* in Xcode — install via Settings → Components, or `xcodebuild -downloadPlatform iOS`.
- *Pod install fails with `xcodebuild` plugin errors* on a fresh Xcode install — usually harmless; running `pod install` directly inside `ios/App` succeeds and the project builds.
- *Mic prompt never appears* — confirm `NSMicrophoneUsageDescription` is in `Info.plist` (it is by default in this project) and that the app is launched from a fresh install.
- *Backend unreachable from device* — use the Mac's LAN IP, not `localhost`, and confirm your firewall doesn't block the dev port.
