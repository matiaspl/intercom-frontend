import Foundation
import Capacitor
@preconcurrency import ActivityKit
import UIKit

/// iOS does not permit free-floating overlays equivalent to Android's
/// SYSTEM_ALERT_WINDOW. Use ActivityKit instead: the same JS bridge drives
/// a Live Activity, which appears on the Lock Screen and in Dynamic Island
/// on supported devices.
@objc(OverlayBubblePlugin)
public class OverlayBubblePlugin: CAPPlugin {

    fileprivate static weak var sharedRef: OverlayBubblePlugin?
    private static var pendingActions: [[String: Any]] = []
    private static var pendingDebugCommands: [String] = []
    private static let notificationPrefix = "com.eyevinn.intercom.overlay-action"
    private static let supportedActions = ["listen", "talk_latch"]
    private static var didRegisterDarwinObservers = false
    public static var shared: OverlayBubblePlugin? { sharedRef }

    static func prepareForLaunch() {
        registerDarwinActionObservers()
    }

    private var runningRequested = false
    private var rowCount = 0
    private var latch: [Bool] = []
    private var listen: [Bool] = []
    private var micAllowed: [Bool] = []
    private var listenAllowed: [Bool] = []
    private var callIds: [String] = []
    private var labels: [String] = []
    private var labelSources: [String] = []
    private var activity: [Bool] = []
    private var lastError: String?
    private var lastRequestAt: String?
    private var lastUpdateAt: String?
    private var lastDebugSnapshotAt: String?
    private var lastAction: [String: Any]?
    private var lastActionAt: String?
    private var jsDebug: [String: Any]?
    private var lastJSAction: [String: Any]?
    private var shouldReplaceLiveActivityOnNextUpsert = true

    public override func load() {
        OverlayBubblePlugin.sharedRef = self
        OverlayBubblePlugin.registerDarwinActionObservers()
        OverlayBubblePlugin.flushPendingActions()
        OverlayBubblePlugin.flushPendingDebugCommands()
    }

    @objc func canDrawOverlays(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            call.resolve(["granted": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["granted": false])
        }
    }

    @objc func openOverlayPermission(_ call: CAPPluginCall) {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            DispatchQueue.main.async {
                UIApplication.shared.open(url)
            }
        }
        call.resolve()
    }

    @objc func show(_ call: CAPPluginCall) {
        runningRequested = true
        lastRequestAt = isoTimestamp()
        upsertLiveActivityIfNeeded()
        writeDebugSnapshot(reason: "show")
        call.resolve()
    }

    @objc func hide(_ call: CAPPluginCall) {
        runningRequested = false
        shouldReplaceLiveActivityOnNextUpsert = true
        endLiveActivity()
        writeDebugSnapshot(reason: "hide")
        call.resolve()
    }

    @objc func setCallRows(_ call: CAPPluginCall) {
        rowCount = max(0, call.getInt("count") ?? 0)
        latch = call.getArray("latch", Bool.self) ?? []
        listen = call.getArray("listen", Bool.self) ?? []
        micAllowed = call.getArray("micAllowed", Bool.self) ?? []
        listenAllowed = call.getArray("listenAllowed", Bool.self) ?? []
        callIds = call.getArray("ids", String.self) ?? []
        labels = call.getArray("labels", String.self) ?? []
        labelSources = call.getArray("labelSources", String.self) ?? []
        activity = call.getArray("activity", Bool.self) ?? []

        if rowCount == 0 {
            endLiveActivity()
        } else {
            upsertLiveActivityIfNeeded()
        }
        writeDebugSnapshot(reason: "setCallRows")
        call.resolve()
    }

    @objc func isRunning(_ call: CAPPluginCall) {
        call.resolve(["running": runningRequested])
    }

    @objc func recordDebugState(_ call: CAPPluginCall) {
        var payload: [String: Any] = [
            "reason": call.getString("reason") ?? "unknown",
            "platform": call.getString("platform") ?? "unknown",
            "callCount": call.getInt("callCount") ?? 0,
            "hasCalls": call.getBool("hasCalls") ?? false,
            "documentHidden": call.getBool("documentHidden") ?? false,
            "documentHasFocus": call.getBool("documentHasFocus") ?? false,
            "timestamp": isoTimestamp(),
        ]
        if let running = call.getBool("running") {
            payload["running"] = running
        }
        if let ids = call.getArray("ids", String.self) {
            payload["ids"] = ids
        }
        if let labels = call.getArray("labels", String.self) {
            payload["labels"] = labels
        }
        if let labelSources = call.getArray("labelSources", String.self) {
            payload["labelSources"] = labelSources
        }
        if let action = call.getString("action") {
            payload["action"] = action
        }
        if let index = call.getInt("index") {
            payload["index"] = index
        }
        if let targetId = call.getString("targetId") {
            payload["targetId"] = targetId
        }
        if let handlerActions = call.getArray("handlerActions", String.self) {
            payload["handlerActions"] = handlerActions
        }
        jsDebug = payload
        if (payload["reason"] as? String) == "bubbleAction-js" {
            lastJSAction = payload
        }
        writeDebugSnapshot(reason: "js-\(payload["reason"] ?? "unknown")")
        call.resolve()
    }

    @objc func getDebugState(_ call: CAPPluginCall) {
        var supported = false
        var enabled = false
        var liveActivityCount = 0
        if #available(iOS 16.1, *) {
            supported = true
            enabled = ActivityAuthorizationInfo().areActivitiesEnabled
            liveActivityCount = Activity<IntercomOverlayAttributes>.activities.count
        }
        call.resolve([
            "supported": supported,
            "liveActivitiesEnabled": enabled,
            "runningRequested": runningRequested,
            "rowCount": rowCount,
            "liveActivityCount": liveActivityCount,
            "ids": callIds,
            "labels": labels,
            "displayLabels": displayLabels(),
            "labelSources": labelSources,
            "lastError": lastError ?? NSNull(),
            "lastRequestAt": lastRequestAt ?? NSNull(),
            "lastUpdateAt": lastUpdateAt ?? NSNull(),
            "lastDebugSnapshotAt": lastDebugSnapshotAt ?? NSNull(),
            "lastAction": lastAction ?? NSNull(),
            "lastActionAt": lastActionAt ?? NSNull(),
            "jsDebug": jsDebug ?? NSNull(),
            "lastJSAction": lastJSAction ?? NSNull(),
        ])
    }

    @objc func showTestActivity(_ call: CAPPluginCall) {
        showTestActivityInternal(reason: "showTestActivity")
        call.resolve()
    }

    private func showTestActivityInternal(reason: String) {
        runningRequested = true
        rowCount = 2
        callIds = ["debug-call-1", "debug-call-2"]
        labels = ["Debug row 1", "Debug row 2"]
        labelSources = ["debug", "debug"]
        latch = [true, false]
        listen = [true, true]
        micAllowed = [true, true]
        listenAllowed = [true, true]
        activity = [true, false]
        lastRequestAt = isoTimestamp()
        upsertLiveActivityIfNeeded()
        writeDebugSnapshot(reason: reason)
    }

    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        call.resolve()
    }

    func hideInternal() {
        runningRequested = false
        shouldReplaceLiveActivityOnNextUpsert = true
        endLiveActivity()
    }

    private func upsertLiveActivityIfNeeded() {
        guard runningRequested, rowCount > 0 else { return }
        guard #available(iOS 16.1, *) else {
            lastError = "Live Activities require iOS 16.1 or newer"
            writeDebugSnapshot(reason: "unsupported")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            lastError = "Live Activities disabled"
            writeDebugSnapshot(reason: "disabled")
            return
        }
        upsertLiveActivity()
    }

    @available(iOS 16.1, *)
    private func upsertLiveActivity() {
        let contentState = buildContentState()
        let shouldReplaceExisting = shouldReplaceLiveActivityOnNextUpsert
        shouldReplaceLiveActivityOnNextUpsert = false
        Task {
            do {
                let activities = Activity<IntercomOverlayAttributes>.activities
                if shouldReplaceExisting {
                    for activity in activities {
                        await activity.end(dismissalPolicy: .immediate)
                    }
                    if #available(iOS 16.2, *) {
                        _ = try Activity<IntercomOverlayAttributes>.request(
                            attributes: IntercomOverlayAttributes(),
                            content: ActivityContent(state: contentState, staleDate: nil),
                            pushType: nil
                        )
                    } else {
                        _ = try Activity<IntercomOverlayAttributes>.request(
                            attributes: IntercomOverlayAttributes(),
                            contentState: contentState,
                            pushType: nil
                        )
                    }
                    DispatchQueue.main.async {
                        self.lastError = nil
                        self.lastUpdateAt = self.isoTimestamp()
                        self.writeDebugSnapshot(reason: "activity-replaced")
                    }
                    return
                }
                let current = activities.first
                for extra in activities.dropFirst() {
                    await extra.end(dismissalPolicy: .immediate)
                }
                if let current {
                    if #available(iOS 16.2, *) {
                        await current.update(ActivityContent(state: contentState, staleDate: nil))
                    } else {
                        await current.update(using: contentState)
                    }
                    DispatchQueue.main.async {
                        self.lastError = nil
                        self.lastUpdateAt = self.isoTimestamp()
                        self.writeDebugSnapshot(reason: "activity-updated")
                    }
                    return
                }
                if #available(iOS 16.2, *) {
                    _ = try Activity<IntercomOverlayAttributes>.request(
                        attributes: IntercomOverlayAttributes(),
                        content: ActivityContent(state: contentState, staleDate: nil),
                        pushType: nil
                    )
                } else {
                    _ = try Activity<IntercomOverlayAttributes>.request(
                        attributes: IntercomOverlayAttributes(),
                        contentState: contentState,
                        pushType: nil
                    )
                }
                DispatchQueue.main.async {
                    self.lastError = nil
                    self.lastUpdateAt = self.isoTimestamp()
                    self.writeDebugSnapshot(reason: "activity-requested")
                }
            } catch {
                DispatchQueue.main.async {
                    self.lastError = String(describing: error)
                    self.writeDebugSnapshot(reason: "activity-error")
                }
                CAPLog.print("OverlayBubblePlugin: failed to update Live Activity: \(error)")
            }
        }
    }

    private func endLiveActivity() {
        guard #available(iOS 16.1, *) else { return }
        shouldReplaceLiveActivityOnNextUpsert = true
        let activities = Activity<IntercomOverlayAttributes>.activities
        Task {
            for activity in activities {
                await activity.end(dismissalPolicy: .immediate)
            }
            DispatchQueue.main.async {
                self.writeDebugSnapshot(reason: "activity-ended")
            }
        }
    }

    @available(iOS 16.1, *)
    private func findLiveActivity() -> Activity<IntercomOverlayAttributes>? {
        return Activity<IntercomOverlayAttributes>.activities.first
    }

    static func routeControlURL(_ url: URL) -> Bool {
        guard url.scheme == "intercom-control" else {
            return false
        }
        if url.host == "overlay-debug" {
            routeDebugURL(url)
            return true
        }
        guard url.host == "overlay-action" else { return false }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return true
        }
        let query = components.queryItems ?? []
        guard let action = query.first(where: { $0.name == "action" })?.value,
              supportedActions.contains(action) else {
            return true
        }
        var payload: [String: Any] = ["action": action]
        if let indexValue = query.first(where: { $0.name == "index" })?.value,
           let index = Int(indexValue) {
            payload["index"] = index
        }
        routeActionPayload(payload)
        return true
    }

    private static func routeDebugURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            routeDebugCommand("snapshot")
            return
        }
        let command = components.queryItems?.first(where: { $0.name == "command" })?.value ?? "snapshot"
        routeDebugCommand(command)
    }

    private static func routeDebugCommand(_ command: String) {
        if let shared = OverlayBubblePlugin.shared {
            shared.handleDebugCommand(command)
        } else {
            pendingDebugCommands.append(command)
            runStandaloneDebugCommand(command, reason: "url-\(command)-before-plugin")
        }
    }

    static func runStandaloneDebugCommand(_ command: String, reason: String) {
        if command == "hide" {
            endStandaloneLiveActivities(reason: reason)
            return
        }
        guard command == "test" else {
            writeStandaloneDebugSnapshot(
                reason: reason,
                rowCount: 0,
                labels: [],
                latch: [],
                listen: [],
                micAllowed: [],
                listenAllowed: [],
                activity: [],
                lastError: nil
            )
            return
        }
        let callIds = ["debug-call-1", "debug-call-2"]
        let labels = ["Debug row 1", "Debug row 2"]
        let labelSources = ["debug", "debug"]
        let latch = [true, false]
        let listen = [true, true]
        let micAllowed = [true, true]
        let listenAllowed = [true, true]
        let active = [true, false]
        guard #available(iOS 16.1, *) else {
            writeStandaloneDebugSnapshot(
                reason: reason,
                rowCount: 2,
                callIds: callIds,
                labels: labels,
                displayLabels: labels,
                labelSources: labelSources,
                latch: latch,
                listen: listen,
                micAllowed: micAllowed,
                listenAllowed: listenAllowed,
                activity: active,
                lastError: "Live Activities require iOS 16.1 or newer"
            )
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            writeStandaloneDebugSnapshot(
                reason: reason,
                rowCount: 2,
                callIds: callIds,
                labels: labels,
                displayLabels: labels,
                labelSources: labelSources,
                latch: latch,
                listen: listen,
                micAllowed: micAllowed,
                listenAllowed: listenAllowed,
                activity: active,
                lastError: "Live Activities disabled"
            )
            return
        }
        let state = IntercomOverlayAttributes.ContentState(
            count: 2,
            labels: labels,
            latch: latch,
            listen: listen,
            micAllowed: micAllowed,
            listenAllowed: listenAllowed,
            activity: active
        )
        writeStandaloneDebugSnapshot(
            reason: reason,
            rowCount: 2,
            callIds: callIds,
            labels: labels,
            displayLabels: labels,
            labelSources: labelSources,
            latch: latch,
            listen: listen,
            micAllowed: micAllowed,
            listenAllowed: listenAllowed,
            activity: active,
            lastError: nil
        )
        Task {
            do {
                if let current = Activity<IntercomOverlayAttributes>.activities.first {
                    if #available(iOS 16.2, *) {
                        await current.update(ActivityContent(state: state, staleDate: nil))
                    } else {
                        await current.update(using: state)
                    }
                } else if #available(iOS 16.2, *) {
                    _ = try Activity<IntercomOverlayAttributes>.request(
                        attributes: IntercomOverlayAttributes(),
                        content: ActivityContent(state: state, staleDate: nil),
                        pushType: nil
                    )
                } else {
                    _ = try Activity<IntercomOverlayAttributes>.request(
                        attributes: IntercomOverlayAttributes(),
                        contentState: state,
                        pushType: nil
                    )
                }
                writeStandaloneDebugSnapshot(
                    reason: "\(reason)-activity-requested",
                    rowCount: 2,
                    callIds: callIds,
                    labels: labels,
                    displayLabels: labels,
                    labelSources: labelSources,
                    latch: latch,
                    listen: listen,
                    micAllowed: micAllowed,
                    listenAllowed: listenAllowed,
                    activity: active,
                    lastError: nil
                )
            } catch {
                writeStandaloneDebugSnapshot(
                    reason: "\(reason)-activity-error",
                    rowCount: 2,
                    callIds: callIds,
                    labels: labels,
                    displayLabels: labels,
                    labelSources: labelSources,
                    latch: latch,
                    listen: listen,
                    micAllowed: micAllowed,
                    listenAllowed: listenAllowed,
                    activity: active,
                    lastError: String(describing: error)
                )
            }
        }
    }

    private static func endStandaloneLiveActivities(reason: String) {
        guard #available(iOS 16.1, *) else {
            writeStandaloneDebugSnapshot(
                reason: reason,
                rowCount: 0,
                labels: [],
                latch: [],
                listen: [],
                micAllowed: [],
                listenAllowed: [],
                activity: [],
                lastError: "Live Activities require iOS 16.1 or newer"
            )
            return
        }
        let activities = Activity<IntercomOverlayAttributes>.activities
        writeStandaloneDebugSnapshot(
            reason: reason,
            rowCount: 0,
            labels: [],
            latch: [],
            listen: [],
            micAllowed: [],
            listenAllowed: [],
            activity: [],
            lastError: nil
        )
        Task {
            for activity in activities {
                await activity.end(dismissalPolicy: .immediate)
            }
            writeStandaloneDebugSnapshot(
                reason: "\(reason)-activity-ended",
                rowCount: 0,
                labels: [],
                latch: [],
                listen: [],
                micAllowed: [],
                listenAllowed: [],
                activity: [],
                lastError: nil
            )
        }
    }

    private static func registerDarwinActionObservers() {
        guard !didRegisterDarwinObservers else { return }
        didRegisterDarwinObservers = true
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        for action in ["listen", "talk_latch"] {
            for index in 0..<16 {
                let name = "\(notificationPrefix).\(action).\(index)" as CFString
                CFNotificationCenterAddObserver(
                    center,
                    nil,
                    darwinActionCallback,
                    name,
                    nil,
                    .deliverImmediately
                )
                for value in ["true", "false"] {
                    let valueName = "\(notificationPrefix).\(action).\(index).\(value)" as CFString
                    CFNotificationCenterAddObserver(
                        center,
                        nil,
                        darwinActionCallback,
                        valueName,
                        nil,
                        .deliverImmediately
                    )
                }
            }
        }
    }

    private static let darwinActionCallback: CFNotificationCallback = { _, _, name, _, _ in
        guard let name else { return }
        let rawName = name.rawValue as String
        DispatchQueue.main.async {
            OverlayBubblePlugin.routeDarwinActionName(rawName)
        }
    }

    private static func routeDarwinActionName(_ rawName: String) {
        let prefix = "\(notificationPrefix)."
        guard rawName.hasPrefix(prefix) else { return }
        let payloadText = String(rawName.dropFirst(prefix.count))
        let parts = payloadText.split(separator: ".")
        guard parts.count == 2 || parts.count == 3 else { return }
        let action = String(parts[0])
        guard supportedActions.contains(action),
              let index = Int(parts[1]) else { return }
        var payload: [String: Any] = ["action": action, "index": index]
        if parts.count == 3 {
            switch parts[2] {
            case "true":
                payload["value"] = true
            case "false":
                payload["value"] = false
            default:
                return
            }
        }
        routeActionPayload(payload)
    }

    private static func routeActionPayload(_ payload: [String: Any]) {
        if let shared = OverlayBubblePlugin.shared {
            shared.emitBubbleAction(payload)
        } else {
            pendingActions.append(payload)
            writeStandaloneDebugSnapshot(
                reason: "pending-action",
                rowCount: 0,
                labels: [],
                latch: [],
                listen: [],
                micAllowed: [],
                listenAllowed: [],
                activity: [],
                lastError: nil,
                lastAction: payload
            )
        }
    }

    private static func flushPendingActions() {
        guard let shared = OverlayBubblePlugin.shared else { return }
        for action in pendingActions {
            shared.emitBubbleAction(action)
        }
        pendingActions.removeAll()
    }

    private static func flushPendingDebugCommands() {
        guard let shared = OverlayBubblePlugin.shared else { return }
        for command in pendingDebugCommands {
            shared.handleDebugCommand(command)
        }
        pendingDebugCommands.removeAll()
    }

    private func handleDebugCommand(_ command: String) {
        switch command {
        case "test":
            showTestActivityInternal(reason: "url-test")
        case "hide":
            runningRequested = false
            endLiveActivity()
            writeDebugSnapshot(reason: "url-hide")
        default:
            writeDebugSnapshot(reason: "url-snapshot")
        }
    }

    private func emitBubbleAction(_ payload: [String: Any]) {
        lastAction = payload
        lastActionAt = isoTimestamp()
        applyOptimisticAction(payload)
        writeDebugSnapshot(reason: "bubbleAction")
        notifyListeners("bubbleAction", data: payload, retainUntilConsumed: true)
        if let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
           let json = String(data: data, encoding: .utf8) {
            bridge?.triggerWindowJSEvent(eventName: "intercomOverlayAction", data: json)
        }
    }

    private func applyOptimisticAction(_ payload: [String: Any]) {
        guard rowCount > 0,
              let action = payload["action"] as? String else {
            return
        }
        let targetIndices: [Int]
        if let index = payload["index"] as? Int {
            targetIndices = [index]
        } else {
            targetIndices = Array(0..<rowCount)
        }

        var changed = false
        let requestedValue = payload["value"] as? Bool
        switch action {
        case "listen":
            listen = normalizedBoolRows(listen, defaultValue: true)
            for index in targetIndices where index >= 0 && index < rowCount {
                guard boolValue(listenAllowed, at: index, defaultValue: true) else { continue }
                if let requestedValue {
                    listen[index] = requestedValue
                } else {
                    listen[index].toggle()
                }
                changed = true
            }
        case "talk_latch":
            latch = normalizedBoolRows(latch, defaultValue: false)
            for index in targetIndices where index >= 0 && index < rowCount {
                guard boolValue(micAllowed, at: index, defaultValue: true) else { continue }
                if let requestedValue {
                    latch[index] = requestedValue
                } else {
                    latch[index].toggle()
                }
                changed = true
            }
        default:
            return
        }

        if changed {
            upsertLiveActivityIfNeeded()
        }
    }

    private static func writeStandaloneDebugSnapshot(
        reason: String,
        rowCount: Int,
        callIds: [String] = [],
        labels: [String],
        displayLabels: [String]? = nil,
        labelSources: [String] = [],
        latch: [Bool],
        listen: [Bool],
        micAllowed: [Bool],
        listenAllowed: [Bool],
        activity: [Bool],
        lastError: String?,
        lastAction: [String: Any]? = nil
    ) {
        var supported = false
        var enabled = false
        var liveActivityCount = 0
        var liveActivityStates: [String] = []
        if #available(iOS 16.1, *) {
            supported = true
            enabled = ActivityAuthorizationInfo().areActivitiesEnabled
            let activities = Activity<IntercomOverlayAttributes>.activities
            liveActivityCount = activities.count
            liveActivityStates = activities.map { String(describing: $0.activityState) }
        }
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let payload: [String: Any] = [
            "reason": reason,
            "timestamp": timestamp,
            "supported": supported,
            "liveActivitiesEnabled": enabled,
            "runningRequested": reason.contains("test"),
            "rowCount": rowCount,
            "liveActivityCount": liveActivityCount,
            "liveActivityStates": liveActivityStates,
            "ids": callIds,
            "labels": labels,
            "displayLabels": displayLabels ?? labels,
            "labelSources": labelSources,
            "latch": latch,
            "listen": listen,
            "micAllowed": micAllowed,
            "listenAllowed": listenAllowed,
            "activity": activity,
            "lastError": lastError ?? NSNull(),
            "lastAction": lastAction ?? NSNull(),
        ]
        writeDebugPayload(payload)
    }

    private func writeDebugSnapshot(reason: String) {
        var supported = false
        var enabled = false
        var liveActivityCount = 0
        var liveActivityStates: [String] = []
        if #available(iOS 16.1, *) {
            supported = true
            enabled = ActivityAuthorizationInfo().areActivitiesEnabled
            let activities = Activity<IntercomOverlayAttributes>.activities
            liveActivityCount = activities.count
            liveActivityStates = activities.map { String(describing: $0.activityState) }
        }
        lastDebugSnapshotAt = isoTimestamp()
        let payload: [String: Any] = [
            "reason": reason,
            "timestamp": lastDebugSnapshotAt ?? "",
            "supported": supported,
            "liveActivitiesEnabled": enabled,
            "runningRequested": runningRequested,
            "rowCount": rowCount,
            "liveActivityCount": liveActivityCount,
            "liveActivityStates": liveActivityStates,
            "ids": callIds,
            "labels": labels,
            "displayLabels": displayLabels(),
            "labelSources": labelSources,
            "latch": latch,
            "listen": listen,
            "micAllowed": micAllowed,
            "listenAllowed": listenAllowed,
            "activity": activity,
            "lastError": lastError ?? NSNull(),
            "lastRequestAt": lastRequestAt ?? NSNull(),
            "lastUpdateAt": lastUpdateAt ?? NSNull(),
            "lastAction": lastAction ?? NSNull(),
            "lastActionAt": lastActionAt ?? NSNull(),
            "jsDebug": jsDebug ?? NSNull(),
            "lastJSAction": lastJSAction ?? NSNull(),
        ]
        OverlayBubblePlugin.writeDebugPayload(payload)
    }

    private static func writeDebugPayload(_ payload: [String: Any]) {
        do {
            guard let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
                return
            }
            let fileURL = documentsURL.appendingPathComponent("intercom-live-activity-debug.json")
            let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            CAPLog.print("OverlayBubblePlugin: failed to write Live Activity debug snapshot: \(error)")
        }
    }

    @available(iOS 16.1, *)
    private func buildContentState() -> IntercomOverlayAttributes.ContentState {
        IntercomOverlayAttributes.ContentState(
            count: rowCount,
            labels: displayLabels(),
            latch: latch,
            listen: listen,
            micAllowed: micAllowed,
            listenAllowed: listenAllowed,
            activity: activity
        )
    }

    private func displayLabels() -> [String] {
        (0..<max(0, rowCount)).map { index in
            if let label = stringValue(labels, at: index), !label.isEmpty {
                return label
            }
            if let callId = stringValue(callIds, at: index), !callId.isEmpty {
                return "Call \(shortCallId(callId))"
            }
            return "Call \(index + 1)"
        }
    }

    private func stringValue(_ values: [String], at index: Int) -> String? {
        guard index >= 0 && index < values.count else { return nil }
        return values[index].trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func boolValue(_ values: [Bool], at index: Int, defaultValue: Bool) -> Bool {
        guard index >= 0 && index < values.count else { return defaultValue }
        return values[index]
    }

    private func normalizedBoolRows(_ values: [Bool], defaultValue: Bool) -> [Bool] {
        let total = max(0, rowCount)
        return (0..<total).map { index in
            index < values.count ? values[index] : defaultValue
        }
    }

    private func shortCallId(_ value: String) -> String {
        guard value.count > 12 else { return value }
        let prefix = value.prefix(6)
        let suffix = value.suffix(4)
        return "\(prefix)...\(suffix)"
    }

    private func isoTimestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
