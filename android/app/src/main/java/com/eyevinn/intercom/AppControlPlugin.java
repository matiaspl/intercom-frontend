package com.eyevinn.intercom;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppControl")
public class AppControlPlugin extends Plugin {

    @PluginMethod
    public void getBuildInfo(PluginCall call) {
        boolean debuggable =
                (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        JSObject ret = new JSObject();
        ret.put("debuggable", debuggable);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopServices(PluginCall call) {
        Context ctx = getContext();
        try { ctx.stopService(new Intent(ctx, OverlayService.class)); } catch (Exception ignored) {}
        try { ctx.stopService(new Intent(ctx, CallService.class)); } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        stopServices(call);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getActivity().finishAndRemoveTask();
        } else {
            getActivity().finish();
        }
    }
}

