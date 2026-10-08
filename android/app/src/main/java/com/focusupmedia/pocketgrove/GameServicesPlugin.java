// Pocket Grove leaderboards and achievements through Google Play Games.
// Matches src/platform/gameServices.ts. Play Games is set up (and the player
// signed in) by CloudSavePlugin. Ids come from the Play Console.
package com.focusupmedia.pocketgrove;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;

@CapacitorPlugin(name = "GameServices")
public class GameServicesPlugin extends Plugin {
    @PluginMethod
    public void submitScore(PluginCall call) {
        String id = call.getString("leaderboard");
        Integer score = call.getInt("score");
        try {
            if (id != null && !id.isEmpty() && score != null) PlayGames.getLeaderboardsClient(getActivity()).submitScore(id, score);
        } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        String id = call.getString("achievement");
        try {
            if (id != null && !id.isEmpty()) PlayGames.getAchievementsClient(getActivity()).unlock(id);
        } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void showLeaderboards(PluginCall call) {
        try {
            PlayGames.getLeaderboardsClient(getActivity()).getAllLeaderboardsIntent()
                .addOnSuccessListener(intent -> getActivity().startActivityForResult(intent, 9101));
        } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void showAchievements(PluginCall call) {
        try {
            PlayGames.getAchievementsClient(getActivity()).getAchievementsIntent()
                .addOnSuccessListener(intent -> getActivity().startActivityForResult(intent, 9102));
        } catch (Exception ignored) { }
        call.resolve();
    }
}
