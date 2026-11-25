package io.github.cooksaa.hava;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Aplikacija šalje podatke za widget (src/android.ts) i widget se odmah osvježi. */
@CapacitorPlugin(name = "HavaWidget")
public class HavaWidgetPlugin extends Plugin {

    @PluginMethod
    public void postavi(PluginCall call) {
        String podaci = call.getString("podaci");
        if (podaci == null) {
            call.reject("Nema podataka za widget.");
            return;
        }
        Context c = getContext();
        c.getSharedPreferences(HavaWidget.POSTAVKE, Context.MODE_PRIVATE)
            .edit()
            .putString(HavaWidget.KLJUC, podaci)
            .apply();
        HavaWidget.osvjeziSve(c);
        call.resolve();
    }
}
