// Pocket Grove leaderboards and achievements through Game Center.
// Matches src/platform/gameServices.ts. Registered in ViewController.swift.
// The player is signed in by CloudSavePlugin at launch.

import Capacitor
import GameKit

@objc(GameServicesPlugin)
public class GameServicesPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameServicesPlugin"
    public let jsName = "GameServices"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboards", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showAchievements", returnType: CAPPluginReturnPromise),
    ]

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated, let id = call.getString("leaderboard") else { return call.resolve() }
        let score = call.getInt("score") ?? 0
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { _ in call.resolve() }
    }

    @objc func unlock(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated, let id = call.getString("achievement") else { return call.resolve() }
        let a = GKAchievement(identifier: id)
        a.percentComplete = 100
        a.showsCompletionBanner = true
        GKAchievement.report([a]) { _ in call.resolve() }
    }

    private func show(_ state: GKGameCenterViewControllerState, _ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { return call.resolve() }
        DispatchQueue.main.async {
            let vc = GKGameCenterViewController(state: state)
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }

    @objc func showLeaderboards(_ call: CAPPluginCall) { show(.leaderboards, call) }
    @objc func showAchievements(_ call: CAPPluginCall) { show(.achievements, call) }

    public func gameCenterViewControllerDidFinish(_ vc: GKGameCenterViewController) {
        vc.dismiss(animated: true)
    }
}
