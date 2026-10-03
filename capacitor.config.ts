import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: appId is permanent once published to the stores (approved: Pocket Grove
// by Focus Up Media, see docs/DECISIONS.md A83).
const config: CapacitorConfig = {
  appId: 'com.focusupmedia.pocketgrove',
  appName: 'Pocket Grove',
  webDir: 'dist',
  backgroundColor: '#0f1a24',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default config;
