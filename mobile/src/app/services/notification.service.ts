import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationId = 1;

  async requestPermission(): Promise<boolean> {
    console.log('[Notification] Requesting permission...');
    const permission = await LocalNotifications.requestPermissions();
    console.log('[Notification] Permission result:', permission);
    return permission.display === 'granted';
  }

  async showValidationNotification(nickname: string, orderPointName: string): Promise<void> {
    console.log('[Notification] showValidationNotification called:', { nickname, orderPointName });
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('[Notification] Permission not granted');
        return;
      }

      const notificationId = this.notificationId++;
      console.log('[Notification] Scheduling notification with id:', notificationId);

      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'New Validation Request',
            body: `${nickname || 'Someone'} at ${orderPointName} needs approval`,
            id: notificationId,
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'default',
            smallIcon: 'ic_launcher',
            largeIcon: 'ic_launcher',
            actionTypeId: 'VALIDATION_REQUEST'
          }
        ]
      });
      console.log('[Notification] Notification scheduled successfully');
    } catch (error) {
      console.error('[Notification] Error showing notification:', error);
    }
  }
}