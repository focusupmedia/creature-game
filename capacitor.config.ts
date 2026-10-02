import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: appId is permanent once published to the stores. Placeholder until the
// final game name is approved (see docs/DECISIONS.md).
const config: CapacitorConfig = {
  appId: 'com.focusupmedia.kindredgrove',
  appName: 'Kindred Grove',
  webDir: 'dist',
  backgroundColor: '#0f1a24',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default config;
