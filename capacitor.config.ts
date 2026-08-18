import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iponipon.app',
  appName: 'IponIpon',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
