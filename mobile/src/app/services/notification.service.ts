import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const ORDERS_CHANNEL_ID = 'orders';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationId = 1;
  private permissionGranted: boolean | null = null;
  private channelEnsured = false;

  async requestPermission(): Promise<boolean> {
    if (this.permissionGranted !== null) return this.permissionGranted;
    console.log('[Notification] Requesting permission...');
    try {
      const permission = await LocalNotifications.requestPermissions();
      console.log('[Notification] Permission result:', permission);
      this.permissionGranted = permission.display === 'granted';
    } catch (e) {
      console.warn('[Notification] requestPermissions failed (likely web preview):', e);
      this.permissionGranted = false;
    }
    if (this.permissionGranted) {
      await this.ensureChannel();
    }
    return this.permissionGranted;
  }

  // On Android 8+ sound/vibration/heads-up are controlled by the channel, not
  // the per-notification fields. iOS ignores channels — this is a no-op there.
  private async ensureChannel(): Promise<void> {
    if (this.channelEnsured) return;
    try {
      await LocalNotifications.createChannel({
        id: ORDERS_CHANNEL_ID,
        name: 'Orders',
        description: 'New orders and order status updates',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#3b82f6'
      });
    } catch (e) {
      console.warn('[Notification] createChannel skipped:', e);
    }
    this.channelEnsured = true;
  }

  async showValidationNotification(nickname: string, orderPointName: string): Promise<void> {
    await this.show({
      title: 'New Validation Request',
      body: `${nickname || 'Someone'} at ${orderPointName} needs approval`,
      actionTypeId: 'VALIDATION_REQUEST'
    });
  }

  async showOrderReceived(orderNo: number | string | undefined, orderPointName?: string): Promise<void> {
    const where = orderPointName ? ` for ${orderPointName}` : '';
    await this.show({
      title: 'Order received',
      body: orderNo != null ? `Order #${orderNo}${where}` : `New order${where}`,
      actionTypeId: 'ORDER_RECEIVED'
    });
  }

  async showOrderReady(orderNo: number | string | undefined, orderPointName?: string): Promise<void> {
    const where = orderPointName ? ` at ${orderPointName}` : '';
    await this.show({
      title: 'Order ready',
      body: orderNo != null ? `Order #${orderNo} is ready${where}` : `An order is ready${where}`,
      actionTypeId: 'ORDER_READY'
    });
  }

  private async show(opts: { title: string; body: string; actionTypeId?: string }): Promise<void> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('[Notification] Permission not granted, skipping:', opts.title);
        return;
      }
      const notificationId = this.notificationId++;
      await LocalNotifications.schedule({
        notifications: [
          {
            title: opts.title,
            body: opts.body,
            id: notificationId,
            schedule: { at: new Date(Date.now() + 100) },
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            channelId: ORDERS_CHANNEL_ID,
            actionTypeId: opts.actionTypeId
          }
        ]
      });
    } catch (error) {
      console.error('[Notification] Error scheduling notification:', error);
    }
  }
}
