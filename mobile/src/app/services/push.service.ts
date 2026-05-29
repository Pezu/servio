import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PushService {
  private currentToken: string | null = null;
  private listenersAttached = false;

  constructor(private http: HttpClient) {}

  // Called from AuthService.login() once the JWT is stored. Idempotent — safe
  // to invoke on every app start.
  async init(authToken: string): Promise<void> {
    console.log('[Push] init() called, native=' + Capacitor.isNativePlatform());
    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Skipping init — web platform');
      return;
    }

    try {
      let perm = await PushNotifications.checkPermissions();
      console.log('[Push] checkPermissions=' + perm.receive);
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        perm = await PushNotifications.requestPermissions();
        console.log('[Push] requestPermissions=' + perm.receive);
      }
      if (perm.receive !== 'granted') {
        console.warn('[Push] Permission not granted: ' + perm.receive);
        return;
      }

      this.attachListenersOnce(authToken);
      console.log('[Push] calling PushNotifications.register()');
      await PushNotifications.register();
    } catch (e: any) {
      console.error('[Push] init failed: ' + (e?.message ?? String(e)));
    }
  }

  // Tear down a token when the user logs out. The backend will stop trying to
  // reach this device. The FCM SDK keeps the device token alive — that's fine,
  // it's bound to a new user on the next login.
  async unregister(authToken: string | null): Promise<void> {
    const token = this.currentToken;
    this.currentToken = null;
    if (!token || !authToken) return;
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/push/unregister/${encodeURIComponent(token)}`, {
          headers: this.headers(authToken)
        })
      );
    } catch (e) {
      console.warn('[Push] unregister failed (server may not have the token):', e);
    }
  }

  private attachListenersOnce(authToken: string): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] FCM token received, length=' + token.value.length);
      this.currentToken = token.value;
      try {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/push/register`,
            { token: token.value, platform: Capacitor.getPlatform() },
            { headers: this.headers(authToken) })
        );
        console.log('[Push] Token registered with backend');
      } catch (e: any) {
        const status = e?.status ?? 'unknown';
        const body = e?.error ? JSON.stringify(e.error) : (e?.message ?? String(e));
        console.error(`[Push] Token register failed: HTTP ${status} body=${body}`);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error', error);
    });

    // When the app is in the foreground, FCM delivers a data-only payload by
    // default and the system tray notification is suppressed. Re-emit it as a
    // local notification so the user still sees + hears it.
    PushNotifications.addListener('pushNotificationReceived', async (n: PushNotificationSchema) => {
      const title = n.title || (n.data && n.data['title']) || 'Notification';
      const body = n.body || (n.data && n.data['body']) || '';
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Date.now() % 2147483647),
            title,
            body,
            channelId: 'orders',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher'
          }]
        });
      } catch (e) {
        console.warn('[Push] Foreground re-display failed', e);
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped', action.notification?.data);
    });
  }

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}
