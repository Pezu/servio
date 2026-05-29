import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.servio.mobile',
  appName: 'Servio',
  webDir: 'dist/servio-mobile/browser',
  server: {
    // http (not https) so the in-WebView app URL is http://localhost/.
    // That avoids "mixed content" when the app fetches an http:// LAN
    // backend in local dev. Production still calls https://servioapp.ro
    // (http page → https API is a permitted upgrade, not mixed content).
    androidScheme: 'http'
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