import Foundation
import UIKit
import Capacitor

@objc(AppControlPlugin)
public class AppControlPlugin: CAPPlugin {

    @objc func getBuildInfo(_ call: CAPPluginCall) {
        #if DEBUG
        let debuggable = true
        #else
        let debuggable = false
        #endif
        call.resolve(["debuggable": debuggable])
    }

    @objc func stopServices(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            CallServicePlugin.shared?.stopInternal()
            OverlayBubblePlugin.shared?.hideInternal()
        }
        call.resolve()
    }

    @objc func exitApp(_ call: CAPPluginCall) {
        // iOS does not permit apps to exit programmatically. Just stop services
        // and resign — the user can dismiss with the home indicator.
        DispatchQueue.main.async {
            CallServicePlugin.shared?.stopInternal()
            OverlayBubblePlugin.shared?.hideInternal()
            UIApplication.shared.perform(Selector(("suspend")))
        }
        call.resolve()
    }
}
