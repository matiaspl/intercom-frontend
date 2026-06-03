#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(OverlayBubblePlugin, "OverlayBubble",
           CAP_PLUGIN_METHOD(canDrawOverlays, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(openOverlayPermission, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(show, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(hide, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setCallRows, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isRunning, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(recordDebugState, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getDebugState, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(showTestActivity, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(requestNotificationPermission, CAPPluginReturnPromise);
)
