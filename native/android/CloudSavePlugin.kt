// Kindred Grove cloud save for Android: Google Play Games saved games
// (Snapshots). Matches src/platform/cloudSave.ts.
// Not compiled yet: add to the Android project when it is created
// (see docs/CLOUD_SAVE.md). Needs Play Games Services v2 set up in the
// Play Console with "Saved games" turned on.

package com.focusupmedia.kindredgrove

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
import org.json.JSONObject

@CapacitorPlugin(name = "CloudSave")
class CloudSavePlugin : Plugin() {

    override fun load() {
        // Play Games v2 signs the player in automatically at launch.
        PlayGamesSdk.initialize(context)
    }

    @PluginMethod
    fun status(call: PluginCall) {
        PlayGames.getGamesSignInClient(activity).isAuthenticated.addOnCompleteListener { task ->
            val signedIn = task.isSuccessful && task.result.isAuthenticated
            if (!signedIn) return@addOnCompleteListener call.resolve(JSObject().put("available", true).put("signedIn", false))
            PlayGames.getPlayersClient(activity).currentPlayer.addOnCompleteListener { p ->
                call.resolve(JSObject().put("available", true).put("signedIn", true).put("account", if (p.isSuccessful) p.result.displayName else ""))
            }
        }
    }

    @PluginMethod
    fun signIn(call: PluginCall) {
        PlayGames.getGamesSignInClient(activity).signIn().addOnCompleteListener { task ->
            call.resolve(JSObject().put("signedIn", task.isSuccessful && task.result.isAuthenticated))
        }
    }

    @PluginMethod
    fun load(call: PluginCall) {
        val slot = call.getString("slot") ?: "main"
        val snapshots = PlayGames.getSnapshotsClient(activity)
        snapshots.open(slot, false, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED).addOnCompleteListener { task ->
            if (!task.isSuccessful) return@addOnCompleteListener call.resolve(JSObject().put("found", false))
            val snap = task.result.data ?: return@addOnCompleteListener call.resolve(JSObject().put("found", false))
            val env = JSONObject(String(snap.snapshotContents.readFully()))
            snapshots.discardAndClose(snap)
            call.resolve(JSObject().put("found", true).put("data", env.optString("data")).put("summary", env.optString("summary")))
        }
    }

    @PluginMethod
    fun save(call: PluginCall) {
        val slot = call.getString("slot") ?: "main"
        val env = JSONObject().put("data", call.getString("data") ?: "").put("summary", call.getString("summary") ?: "")
        val snapshots = PlayGames.getSnapshotsClient(activity)
        snapshots.open(slot, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED).addOnCompleteListener { task ->
            val snap = if (task.isSuccessful) task.result.data else null
            if (snap == null) return@addOnCompleteListener call.resolve(JSObject().put("ok", false))
            snap.snapshotContents.writeBytes(env.toString().toByteArray())
            val meta = SnapshotMetadataChange.Builder().setDescription(call.getString("description") ?: "Kindred Grove").build()
            snapshots.commitAndClose(snap, meta).addOnCompleteListener { done -> call.resolve(JSObject().put("ok", done.isSuccessful)) }
        }
    }
}
