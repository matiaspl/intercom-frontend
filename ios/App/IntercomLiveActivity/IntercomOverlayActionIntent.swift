import AppIntents
import ActivityKit
import Foundation

@available(iOS 17.0, *)
struct IntercomOverlayActionIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Control intercom call"
    static var description = IntentDescription("Toggle a call microphone or speaker from the Intercom Live Activity.")
    static var openAppWhenRun = false

    @Parameter(title: "Action")
    var action: String

    @Parameter(title: "Index")
    var index: Int

    init() {
        self.action = "listen"
        self.index = 0
    }

    init(action: String, index: Int) {
        self.action = action
        self.index = index
    }

    func perform() async throws -> some IntentResult {
        IntercomOverlayActionNotifier.post(action: action, index: index)
        await IntercomOverlayActionNotifier.applyOptimisticUpdate(action: action, index: index)
        return .result()
    }
}

@available(iOS 17.0, *)
struct IntercomOverlayToggleIntent: LiveActivityIntent, SetValueIntent {
    static var title: LocalizedStringResource = "Set intercom call control"
    static var description = IntentDescription("Set a call microphone or speaker state from the Intercom Live Activity.")
    static var openAppWhenRun = false

    @Parameter(title: "Enabled")
    var value: Bool

    @Parameter(title: "Action")
    var action: String

    @Parameter(title: "Index")
    var index: Int

    init() {
        self.value = false
        self.action = "listen"
        self.index = 0
    }

    init(action: String, index: Int) {
        self.value = false
        self.action = action
        self.index = index
    }

    func perform() async throws -> some IntentResult {
        IntercomOverlayActionNotifier.post(action: action, index: index, value: value)
        await IntercomOverlayActionNotifier.applyOptimisticUpdate(action: action, index: index, value: value)
        return .result()
    }
}

enum IntercomOverlayActionNotifier {
    static let notificationPrefix = "com.eyevinn.intercom.overlay-action"

    @available(iOS 17.0, *)
    static func applyOptimisticUpdate(action: String, index: Int, value: Bool? = nil) async {
        guard action == "listen" || action == "talk_latch" else { return }
        for activity in Activity<IntercomOverlayAttributes>.activities {
            var state = activity.content.state
            guard index >= 0 && index < state.count else { continue }
            switch action {
            case "listen":
                guard boolValue(state.listenAllowed, at: index, defaultValue: true) else { continue }
                state.listen = normalizedBoolRows(state.listen, count: state.count, defaultValue: true)
                if let value {
                    state.listen[index] = value
                } else {
                    state.listen[index].toggle()
                }
            case "talk_latch":
                guard boolValue(state.micAllowed, at: index, defaultValue: true) else { continue }
                state.latch = normalizedBoolRows(state.latch, count: state.count, defaultValue: false)
                if let value {
                    state.latch[index] = value
                } else {
                    state.latch[index].toggle()
                }
            default:
                continue
            }
            state.updatedAt = Date()
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }
    }

    static func post(action: String, index: Int, value: Bool? = nil) {
        let suffix = value.map { ".\($0 ? "true" : "false")" } ?? ""
        let name = "\(notificationPrefix).\(action).\(index)\(suffix)" as CFString
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(name),
            nil,
            nil,
            true
        )
    }

    private static func boolValue(_ values: [Bool], at index: Int, defaultValue: Bool) -> Bool {
        guard index >= 0 && index < values.count else { return defaultValue }
        return values[index]
    }

    private static func normalizedBoolRows(_ values: [Bool], count: Int, defaultValue: Bool) -> [Bool] {
        (0..<max(0, count)).map { index in
            index < values.count ? values[index] : defaultValue
        }
    }
}
