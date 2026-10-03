import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './ui/styles.css';
import { Game } from './game/Game';
import { applyRemoteConfig } from './platform/services';
import { showSplash } from './ui/brand';

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  // the title splash covers the first moments while the world builds
  const hideSplash = showSplash(document.body);
  document.getElementById('boot')?.remove();
  // Remote config can retune events, shop and economy without an app update.
  await applyRemoteConfig(import.meta.env.VITE_REMOTE_CONFIG_URL as string | undefined);
  const game = new Game(app);
  game.start();
  setTimeout(hideSplash, 1400);
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { game: Game }).game = game;
  }
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('boot');
  if (el) el.textContent = 'Pocket Grove could not open. WebGL may be unavailable on this device.';
});
