import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.servio.mobile',
  appName: 'Servio',
  webDir: 'dist/servio-mobile/browser',
  server: {
    // PROD (servioapp.ro). https so the WebView origin is https://localhost/ —
    // matches prod CORS (https://localhost / capacitor://localhost) and is
    // same-scheme with the https backend. For LOCAL http LAN dev, flip to
    // androidScheme: 'http'.
    androidScheme: 'https'
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
      smallIcon: 'ic_stat_notification',
      iconColor: '#3b82f6',
      sound: 'default'
    }
  }
};

export default config;