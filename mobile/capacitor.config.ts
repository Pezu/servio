import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.servio.mobile',
  appName: 'Servio',
  webDir: 'dist/servio-mobile/browser',
  server: {
    androidScheme: 'http',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'light',
      backgroundColor: '#3b82f6'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#3b82f6',
      sound: 'default'
    }
  }
};

export default config;