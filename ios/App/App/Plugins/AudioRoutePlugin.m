#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AudioRoutePlugin, "AudioRoute",
           CAP_PLUGIN_METHOD(getAvailableRoutes, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setRoute, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(playTestTone, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopTestTone, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(hasBluetoothPermission, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(requestBluetoothPermission, CAPPluginReturnPromise);
)
