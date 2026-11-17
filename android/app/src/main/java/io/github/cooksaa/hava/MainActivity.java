package io.github.cooksaa.hava;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Prvo Capacitor: on prebaci temu s početnog ekrana na pravu temu aplikacije.
        // Da je EdgeToEdge pozvan prije, prozor bi se napravio sa starom temom
        // i na vrhu bi ostala traka s naslovom i stisnutom slikom početnog ekrana.
        super.onCreate(savedInstanceState);

        // Nebo ide do rubova ekrana i na starijim Androidima, isto kao od Androida 15.
        // Trake su prozirne, ikone u njima uvijek svijetle (nebo je gore uvijek tamno).
        // Sigurne zone (izrez za kameru, navigacija) rješava CSS preko safe-area-inset.
        EdgeToEdge.enable(
            this,
            SystemBarStyle.dark(Color.TRANSPARENT),
            SystemBarStyle.dark(Color.TRANSPARENT)
        );
    }
}
