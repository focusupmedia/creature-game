// Pocket Grove cloud save for iPhone / iPad: Game Center saved games
// (stored in the player's iCloud). Matches src/platform/cloudSave.ts.
// Registered in ViewController.swift. Needs the Game Center and iCloud
// (iCloud Documents) capabilities (App.entitlements).

import Capacitor
import GameKit

@objc(CloudSavePlugin)
public class CloudSavePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudSavePlugin"
    public let jsName = "CloudSave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
    ]

    /// Game Center's sign-in screen, if it asked for one at launch.
    private var pendingLogin: UIViewController?

    public override func load() {
        // Sign in automatically at launch. If Game Center needs the player to
        // log in, keep its screen for when they tap "Sign in" in Settings.
        GKLocalPlayer.local.authenticateHandler = { [weak self] vc, _ in
            self?.pendingLogin = vc
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        let p = GKLocalPlayer.local
        call.resolve(["available": true, "signedIn": p.isAuthenticated, "account": p.isAuthenticated ? p.displayName : ""])
    }

    @objc func signIn(_ call: CAPPluginCall) {
        if GKLocalPlayer.local.isAuthenticated { return call.resolve(["signedIn": true]) }
        guard let vc = pendingLogin else {
            // Game Center is turned off for this app in iOS Settings
            return call.resolve(["signedIn": false])
        }
        DispatchQueue.main.async {
            GKLocalPlayer.local.authenticateHandler = { [weak self] next, _ in
                self?.pendingLogin = next
                if next == nil { call.resolve(["signedIn": GKLocalPlayer.local.isAuthenticated]) }
            }
            self.bridge?.viewController?.present(vc, animated: true)
        }
    }

    @objc func load(_ call: CAPPluginCall) {
        let slot = call.getString("slot") ?? "main"
        guard GKLocalPlayer.local.isAuthenticated else { return call.resolve(["found": false]) }
        GKLocalPlayer.local.fetchSavedGames { games, error in
            if let error = error { return call.reject(error.localizedDescription) }
            let mine = (games ?? []).filter { $0.name == slot }
            // two devices saved while offline: keep the newest; the game itself
            // compares it with this device's save and asks the player if needed
            guard let newest = mine.max(by: { ($0.modificationDate ?? .distantPast) < ($1.modificationDate ?? .distantPast) }) else {
                return call.resolve(["found": false])
            }
            newest.loadData { data, error in
                if let error = error { return call.reject(error.localizedDescription) }
                guard let data = data,
                      let env = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
                    return call.resolve(["found": false])
                }
                if mine.count > 1 {
                    GKLocalPlayer.local.resolveConflictingSavedGames(mine, with: data) { _, _ in }
                }
                call.resolve(["found": true, "data": env["data"] ?? "", "summary": env["summary"] ?? ""])
            }
        }
    }

    @objc func save(_ call: CAPPluginCall) {
        let slot = call.getString("slot") ?? "main"
        guard GKLocalPlayer.local.isAuthenticated else { return call.resolve(["ok": false]) }
        let env = ["data": call.getString("data") ?? "", "summary": call.getString("summary") ?? ""]
        guard let bytes = try? JSONSerialization.data(withJSONObject: env) else { return call.resolve(["ok": false]) }
        GKLocalPlayer.local.saveGameData(bytes, withName: slot) { _, error in
            // the reason helps when iCloud Drive is off or not set up for the app
            call.resolve(["ok": error == nil, "error": error?.localizedDescription ?? ""])
        }
    }
}
