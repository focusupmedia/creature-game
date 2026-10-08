// Leaderboards and achievements through Game Center (iPhone) and Google Play
// Games (Android), via our own "GameServices" plugin (ios/App/App and
// android/.../GameServicesPlugin). On the web it quietly does nothing.
// The ids each store uses are in storeKeys.ts (GAME_SERVICE_IDS).

import { Capacitor, registerPlugin } from '@capacitor/core';
import { GAME_SERVICE_IDS } from './storeKeys';

interface GameServicesPlugin {
  submitScore(o: { leaderboard: string; score: number }): Promise<void>;
  unlock(o: { achievement: string }): Promise<void>;
  showLeaderboards(): Promise<void>;
  showAchievements(): Promise<void>;
}

const native = Capacitor.isNativePlatform();
const plugin = native ? registerPlugin<GameServicesPlugin>('GameServices') : null;
const ids = () => (Capacitor.getPlatform() === 'ios' ? GAME_SERVICE_IDS.ios : GAME_SERVICE_IDS.android);

export const gameServices = {
  available: native,
  submit(board: string, score: number): void {
    const id = ids().leaderboards[board as keyof ReturnType<typeof ids>['leaderboards']];
    if (plugin && id) plugin.submitScore({ leaderboard: id, score }).catch(() => {});
  },
  unlock(achievement: string): void {
    const id = ids().achievements[achievement];
    if (plugin && id) plugin.unlock({ achievement: id }).catch(() => {});
  },
  showLeaderboards(): void { plugin?.showLeaderboards().catch(() => {}); },
  showAchievements(): void { plugin?.showAchievements().catch(() => {}); },
};
