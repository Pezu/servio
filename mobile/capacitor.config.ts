import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.servio.mobile',
  appName: 'Servio',
  webDir: 'dist/servio-mobile/browser',
  server: {
    // LOCAL-DEV ONLY. http so the WebView page URL is http://localhost/
    // and fetch() to the http:// LAN backend is same-scheme (no mixed
    // content). Flip back to androidScheme: 'https' before any prod
    // build — prod CORS only trusts https://localhost / capacitor://localhost.
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