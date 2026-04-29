import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'taxibucovina.dispatcher',
  appName: 'Dispatcher Taxi Bucovina',
  webDir: 'dist/public',
  server: {
    url: 'https://taxibucovina.eu',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
