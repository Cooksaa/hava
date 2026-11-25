package io.github.cooksaa.hava;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.content.res.ResourcesCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget na početnom ekranu.
 *
 * Podatke (JSON, src/logic/widget.ts) spremaju aplikacija (HavaWidgetPlugin) i provjera u
 * pozadini (Background Runner, CapacitorKV) u iste postavke. Unutra je kadar za svaki od
 * narednih 24 sata, pa widget sam izabere sat u kojem jeste: tačan je i kad se Hava ne otvara.
 *
 * Tekst se crta kao slika, Havinim fontom: Xiaomijev početni ekran u widgetima ignoriše font
 * aplikacije, a njegov sistemski krivo crta č/š/ž (kvačica padne na sljedeće slovo).
 */
public class HavaWidget extends AppWidgetProvider {

    /** Postavke Background Runnera (CapacitorKV koristi oznaku runnera kao ime). */
    static final String POSTAVKE = "io.github.cooksaa.hava.provjera";
    static final String KLJUC = "hava:widget";
    private static final long SAT = 3_600_000L;
    /** Kadar koji počinje najviše ovoliko u budućnosti još se prikazuje kao "sad". */
    private static final long NAJSTARIJE = 2 * SAT;

    private static final int BIJELA = 0xFFFFFFFF;
    private static final int TIHA = 0xC7FFFFFF;

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, napravi(c, m, id));
    }

    /** Widget promijenio veličinu: tekst se ponovo prelomi za novu širinu. */
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle opcije) {
        m.updateAppWidget(id, napravi(c, m, id));
    }

    /** Osvježi sve Havine widgete odmah (poziva HavaWidgetPlugin poslije novih podataka). */
    static void osvjeziSve(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, HavaWidget.class));
        for (int id : ids) m.updateAppWidget(id, napravi(c, m, id));
    }

    static RemoteViews napravi(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_hava);
        DisplayMetrics dm = c.getResources().getDisplayMetrics();

        // Širina widgeta minus unutrašnji razmak. Xiaomi kao "najmanju" javlja manje od stvarne
        // širine, pa uzimamo veću; ako tekst ipak ne stane, ImageView (fitStart) ga samo smanji.
        Bundle op = m.getAppWidgetOptions(id);
        int sirinaDp = Math.max(
            op.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0),
            op.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0));
        if (sirinaDp <= 0) sirinaDp = 300;
        int puna = px(dm, sirinaDp - 38);
        int lijevo = puna - px(dm, 52); // pored ikone

        Intent otvori = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (otvori != null) {
            PendingIntent pi = PendingIntent.getActivity(
                c, 0, otvori, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_korijen, pi);
        }

        String mjesto = "Hava";
        String temp = "—";
        String izgled = "Otvori Havu za prognozu.";
        String ves = null;
        int ikona = R.drawable.ic_w_oblak;

        String json = c.getSharedPreferences(POSTAVKE, Context.MODE_PRIVATE).getString(KLJUC, null);
        if (json != null) {
            try {
                JSONObject o = new JSONObject(json);
                mjesto = o.optString("mjesto", "Hava");
                JSONObject kadar = kadarZaSad(o.getJSONArray("kadrovi"), System.currentTimeMillis());
                if (kadar == null) {
                    // Svi kadrovi su prošli: telefon dugo bez mreže i bez otvaranja Have.
                    izgled = "Otvori Havu za novu prognozu.";
                } else {
                    temp = kadar.getInt("temp") + "°";
                    ikona = ikona(kadar.optString("ikona"));
                    // Jedna rečenica: "Kiša, pada do 10h." / "Oblačno, kiša oko 15h."
                    String i = kadar.optString("izgled");
                    if (!i.isEmpty()) i = i.substring(0, 1).toLowerCase(Locale.ROOT) + i.substring(1);
                    izgled = kadar.optString("opis") + ", " + i + ".";

                    JSONObject vs = o.optJSONObject("ves");
                    String danas = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
                    if (vs != null && danas.equals(vs.optString("datum"))) ves = "Veš: " + vs.optString("tekst");
                }
            } catch (Exception e) {
                izgled = "Otvori Havu za prognozu.";
            }
        }

        Typeface naslov = font(c, R.font.hava_naslov);
        Typeface broj = font(c, R.font.hava_broj);
        Typeface obican = font(c, R.font.hava_tekst);

        postavi(v, R.id.w_mjesto, tekst(dm, mjesto, naslov, 14, TIHA, lijevo, 1), mjesto);
        postavi(v, R.id.w_temp, tekst(dm, temp, broj, 54, BIJELA, lijevo, 1), temp);
        postavi(v, R.id.w_izgled, tekst(dm, izgled, naslov, 17, BIJELA, puna, 2), izgled);
        if (ves != null) {
            postavi(v, R.id.w_ves, tekst(dm, ves, obican, 14, TIHA, puna, 2), ves);
            v.setViewVisibility(R.id.w_ves, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.w_ves, View.GONE);
        }
        v.setImageViewResource(R.id.w_ikona, ikona);
        return v;
    }

    private static JSONObject kadarZaSad(JSONArray kadrovi, long sad) throws Exception {
        for (int i = 0; i < kadrovi.length(); i++) {
            JSONObject k = kadrovi.getJSONObject(i);
            long t = k.getLong("t");
            if (t <= sad && sad < t + SAT) return k;
            if (t > sad) return t - sad < NAJSTARIJE ? k : null;
        }
        return null;
    }

    private static void postavi(RemoteViews v, int id, Bitmap b, String opis) {
        v.setImageViewBitmap(id, b);
        v.setContentDescription(id, opis);
    }

    private static int px(DisplayMetrics dm, float dp) {
        return Math.max(1, Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, dm)));
    }

    private static Typeface font(Context c, int res) {
        try {
            Typeface t = ResourcesCompat.getFont(c, res);
            return t != null ? t : Typeface.DEFAULT;
        } catch (Exception e) {
            return Typeface.DEFAULT;
        }
    }

    /** Tekst kao slika: prelomljen u `sirina` px, najviše `linija` redova, s "…" ako ne stane. */
    static Bitmap tekst(DisplayMetrics dm, String s, Typeface tf, float sp, int boja, int sirina, int linija) {
        TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        p.setTypeface(tf);
        p.setColor(boja);
        p.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, dm));
        StaticLayout l = StaticLayout.Builder.obtain(s, 0, s.length(), p, Math.max(1, sirina))
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setMaxLines(linija)
            .setEllipsize(TextUtils.TruncateAt.END)
            .setIncludePad(false)
            .setLineSpacing(0, 1.05f)
            .build();
        int w = 1;
        for (int i = 0; i < l.getLineCount(); i++) w = Math.max(w, (int) Math.ceil(l.getLineRight(i)));
        Bitmap b = Bitmap.createBitmap(Math.min(w, Math.max(1, sirina)), Math.max(1, l.getHeight()), Bitmap.Config.ARGB_8888);
        // Ista gustina kao ekran: slika se ne povećava ni ne smanjuje.
        b.setDensity(dm.densityDpi);
        l.draw(new Canvas(b));
        return b;
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
