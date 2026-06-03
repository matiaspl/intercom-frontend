import Foundation
import AVFoundation
import CallKit
import UserNotifications
import Capacitor

@objc(CallServicePlugin)
public class CallServicePlugin: CAPPlugin {

    fileprivate static weak var sharedRef: CallServicePlugin?
    public static var shared: CallServicePlugin? { sharedRef }

    private var provider: CXProvider?
    private var callController: CXCallController?
    private var activeCallUUID: UUID?
    private var running: Bool = false

    public override func load() {
        CallServicePlugin.sharedRef = self

        let config = CXProviderConfiguration()
        config.supportsVideo = false
        config.maximumCallsPerCallGroup = 1
        config.maximumCallGroups = 1
        config.supportedHandleTypes = [.generic]
        provider = CXProvider(configuration: config)
        provider?.setDelegate(CallServiceDelegate.shared, queue: nil)
        callController = CXCallController()
    }

    @objc func start(_ call: CAPPluginCall) {
        startInternal()
        call.resolve(["running": running])
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopInternal()
        call.resolve(["running": running])
    }

    @objc func isRunning(_ call: CAPPluginCall) {
        call.resolve(["running": running])
    }

    @objc func hasNotificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let granted = settings.authorizationStatus == .authorized
                || settings.authorizationStatus == .provisional
                || settings.authorizationStatus == .ephemeral
            call.resolve(["granted": granted])
        }
    }

    @objc func hasRecordAudioPermission(_ call: CAPPluginCall) {
        let status = AVAudioSession.sharedInstance().recordPermission
        call.resolve(["granted": status == .granted])
    }

    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in
            call.resolve()
        }
    }

    // MARK: - Internal

    func startInternal() {
        guard !running else { return }
        let uuid = UUID()
        let handle = CXHandle(type: .generic, value: "Intercom")
        let action = CXStartCallAction(call: uuid, handle: handle)
        let transaction = CXTransaction(action: action)
        callController?.request(transaction) { error in
            if let error = error {
                CAPLog.print("CallServicePlugin: failed to start CallKit call: \(error)")
                return
            }
            self.provider?.reportOutgoingCall(with: uuid, connectedAt: nil)
            self.activeCallUUID = uuid
            self.running = true
        }
    }

    func stopInternal() {
        guard running, let uuid = activeCallUUID else {
            running = false
            activeCallUUID = nil
            return
        }
        let action = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: action)
        callController?.request(transaction) { _ in
            self.activeCallUUID = nil
            self.running = false
        }
    }
}

private class CallServiceDelegate: NSObject, CXProviderDelegate {
    static let shared = CallServiceDelegate()

    func providerDidReset(_ provider: CXProvider) {
        CallServicePlugin.shared?.stopInternal()
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: nil)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // System has activated the audio session; nothing to do — AudioRoutePlugin
        // already configured the category at app load.
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    }
}
