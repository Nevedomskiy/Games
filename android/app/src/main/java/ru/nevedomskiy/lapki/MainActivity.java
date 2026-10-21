package ru.nevedomskiy.lapki;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LapkiVoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
