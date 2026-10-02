import './ui/styles.css';
import { Game } from './game/Game';
import { applyRemoteConfig } from './platform/services';

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  // Remote config can retune events, shop and economy without an app update.
  await applyRemoteConfig(import.meta.env.VITE_REMOTE_CONFIG_URL as string | undefined);
  const game = new Game(app);
  game.start();
  document.getElementById('boot')?.remove();
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { game: Game }).game = game;
  }
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('boot');
  if (el) el.textContent = 'The sanctuary could not open. WebGL may be unavailable on this device.';
});
