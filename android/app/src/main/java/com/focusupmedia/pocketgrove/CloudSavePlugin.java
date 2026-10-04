// Pocket Grove cloud save for Android: Google Play Games saved games
// (Snapshots). Matches src/platform/cloudSave.ts. Needs Play Games Services
// set up in the Play Console with "Saved games" on, and its project id in
// res/values/strings.xml (game_services_project_id). See docs/CLOUD_SAVE.md.
package com.focusupmedia.pocketgrove;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

@CapacitorPlugin(name = "CloudSave")
public class CloudSavePlugin extends Plugin {
    private boolean ready = false;

    @Override
    public void load() {
        // Play Games v2 signs the player in automatically at launch.
        try {
            PlayGamesSdk.initialize(getContext());
            ready = true;
        } catch (Exception e) {
            ready = false;
        }
    }

    private JSObject obj() { return new JSObject(); }

    @PluginMethod
    public void status(PluginCall call) {
        if (!ready) { call.resolve(obj().put("available", false).put("signedIn", false)); return; }
        PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(task -> {
            boolean signedIn = task.isSuccessful() && task.getResult().isAuthenticated();
            if (!signedIn) { call.resolve(obj().put("available", true).put("signedIn", false)); return; }
            PlayGames.getPlayersClient(getActivity()).getCurrentPlayer().addOnCompleteListener(p ->
                call.resolve(obj().put("available", true).put("signedIn", true).put("account", p.isSuccessful() ? p.getResult().getDisplayName() : "")));
        });
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!ready) { call.resolve(obj().put("signedIn", false)); return; }
        PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(task ->
            call.resolve(obj().put("signedIn", task.isSuccessful() && task.getResult().isAuthenticated())));
    }

    @PluginMethod
    public void load(PluginCall call) {
        String slot = call.getString("slot", "main");
        SnapshotsClient snapshots = PlayGames.getSnapshotsClient(getActivity());
        snapshots.open(slot, false, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED).addOnCompleteListener(task -> {
            Snapshot snap = task.isSuccessful() ? task.getResult().getData() : null;
            if (snap == null) { call.resolve(obj().put("found", false)); return; }
            try {
                JSONObject env = new JSONObject(new String(snap.getSnapshotContents().readFully(), StandardCharsets.UTF_8));
                snapshots.discardAndClose(snap);
                call.resolve(obj().put("found", true).put("data", env.optString("data")).put("summary", env.optString("summary")));
            } catch (Exception e) {
                call.resolve(obj().put("found", false));
            }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        String slot = call.getString("slot", "main");
        SnapshotsClient snapshots = PlayGames.getSnapshotsClient(getActivity());
        snapshots.open(slot, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED).addOnCompleteListener(task -> {
            Snapshot snap = task.isSuccessful() ? task.getResult().getData() : null;
            if (snap == null) { call.resolve(obj().put("ok", false)); return; }
            try {
                JSONObject env = new JSONObject().put("data", call.getString("data", "")).put("summary", call.getString("summary", ""));
                snap.getSnapshotContents().writeBytes(env.toString().getBytes(StandardCharsets.UTF_8));
                SnapshotMetadataChange meta = new SnapshotMetadataChange.Builder().setDescription(call.getString("description", "Pocket Grove")).build();
                snapshots.commitAndClose(snap, meta).addOnCompleteListener(done -> call.resolve(obj().put("ok", done.isSuccessful())));
            } catch (Exception e) {
                call.resolve(obj().put("ok", false));
            }
        });
    }
}
