package io.github.cooksaa.hava;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Nebo ide do rubova ekrana i na starijim Androidima, isto kao od Androida 15.
        // Sigurne zone (izrez za kameru, navigacija) rješava CSS preko safe-area-inset.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
