package io.github.cooksaa.hava;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget na početnom ekranu.
 *
 * Podatke (JSON, src/logic/widget.ts) spremaju aplikacija (HavaWidgetPlugin) i provjera u
 * pozadini (Background Runner, CapacitorKV) u iste postavke. Unutra je kadar za svaki od
 * narednih 24 sata, pa widget sam izabere sat u kojem jeste: tačan je i kad se Hava ne otvara.
 */
public class HavaWidget extends AppWidgetProvider {

    /** Postavke Background Runnera (CapacitorKV koristi oznaku runnera kao ime). */
    static final String POSTAVKE = "io.github.cooksaa.hava.provjera";
    static final String KLJUC = "hava:widget";
    private static final long SAT = 3_600_000L;
    /** Kadrovi stariji od ovoga se ne prikazuju kao "sad". */
    private static final long NAJSTARIJE = 2 * SAT;

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        RemoteViews v = napravi(c);
        for (int id : ids) m.updateAppWidget(id, v);
    }

    /** Osvježi sve Havine widgete odmah (poziva HavaWidgetPlugin poslije novih podataka). */
    static void osvjeziSve(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, HavaWidget.class));
        if (ids.length == 0) return;
        RemoteViews v = napravi(c);
        for (int id : ids) m.updateAppWidget(id, v);
    }

    static RemoteViews napravi(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_hava);

        Intent otvori = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (otvori != null) {
            PendingIntent pi = PendingIntent.getActivity(
                c, 0, otvori, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_korijen, pi);
        }

        String json = c.getSharedPreferences(POSTAVKE, Context.MODE_PRIVATE).getString(KLJUC, null);
        if (json == null) return v;
        try {
            JSONObject o = new JSONObject(json);
            JSONArray kadrovi = o.getJSONArray("kadrovi");
            long sad = System.currentTimeMillis();
            JSONObject kadar = null;
            for (int i = 0; i < kadrovi.length(); i++) {
                JSONObject k = kadrovi.getJSONObject(i);
                long t = k.getLong("t");
                if (t <= sad && sad < t + SAT) { kadar = k; break; }
                if (t > sad && kadar == null && t - sad < NAJSTARIJE) { kadar = k; break; }
            }
            v.setTextViewText(R.id.w_mjesto, o.optString("mjesto", "Hava"));
            if (kadar == null) {
                // Svi kadrovi su prošli: telefon dugo bez mreže i bez otvaranja Have.
                v.setTextViewText(R.id.w_temp, "—");
                v.setTextViewText(R.id.w_izgled, "Otvori Havu za novu prognozu");
                v.setViewVisibility(R.id.w_ves, View.GONE);
                return v;
            }
            v.setTextViewText(R.id.w_temp, kadar.getInt("temp") + "°");
            // Jedna rečenica: "Kiša, pada do 10h." / "Oblačno, kiša oko 15h."
            String izgled = kadar.optString("izgled");
            if (!izgled.isEmpty()) izgled = izgled.substring(0, 1).toLowerCase(java.util.Locale.ROOT) + izgled.substring(1);
            v.setTextViewText(R.id.w_izgled, kadar.optString("opis") + ", " + izgled + ".");
            v.setImageViewResource(R.id.w_ikona, ikona(kadar.optString("ikona")));

            JSONObject ves = o.optJSONObject("ves");
            String danas = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT).format(new java.util.Date(sad));
            if (ves != null && danas.equals(ves.optString("datum"))) {
                v.setTextViewText(R.id.w_ves, "Veš: " + ves.optString("tekst"));
                v.setViewVisibility(R.id.w_ves, View.VISIBLE);
            } else {
                v.setViewVisibility(R.id.w_ves, View.GONE);
            }
        } catch (Exception e) {
            v.setTextViewText(R.id.w_izgled, "Otvori Havu za prognozu");
        }
        return v;
    }

    private static int ikona(String ime) {
        switch (ime) {
            case "vedro-dan": return R.drawable.ic_w_vedro_dan;
            case "vedro-noc": return R.drawable.ic_w_vedro_noc;
            case "oblak-dan": return R.drawable.ic_w_oblak_dan;
            case "oblak-noc": return R.drawable.ic_w_oblak_noc;
            case "kisa": return R.drawable.ic_w_kisa;
            case "snijeg": return R.drawable.ic_w_snijeg;
            case "grmljavina": return R.drawable.ic_w_grmljavina;
            case "magla": return R.drawable.ic_w_magla;
            default: return R.drawable.ic_w_oblak;
        }
    }
}
