package com.focusupmedia.pocketgrove;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // our own plugin (npm plugins register themselves)
        registerPlugin(CloudSavePlugin.class);
        registerPlugin(GameServicesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
