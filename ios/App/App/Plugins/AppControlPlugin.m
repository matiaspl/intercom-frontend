#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AppControlPlugin, "AppControl",
           CAP_PLUGIN_METHOD(getBuildInfo, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopServices, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(exitApp, CAPPluginReturnPromise);
)
