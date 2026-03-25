import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterOutlet } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonButtons,
  IonMenu,
  IonMenuButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSplitPane,
  IonRouterOutlet,
  MenuController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  menuOutline,
  logOutOutline,
  receiptOutline,
  checkmarkCircleOutline,
  cardOutline,
  arrowBackOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { EventService, Event } from '../../services/event.service';
import { WebSocketService } from '../../services/websocket.service';
import { NotificationService } from '../../services/notification.service';
import { RegistrationService } from '../../services/registration.service';

@Component({
  selector: 'app-event',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonButtons,
    IonMenu,
    IonMenuButton,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSplitPane,
    IonRouterOutlet
  ],
  template: `
    <ion-menu contentId="event-content" menuId="event-menu">
      <ion-header>
        <ion-toolbar>
          <ion-title>Menu</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-item button (click)="navigateTo('orders')">
            <ion-icon name="receipt-outline" slot="start"></ion-icon>
            <ion-label>Orders</ion-label>
          </ion-item>
          <ion-item button (click)="navigateTo('validations')">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            <ion-label>Validations</ion-label>
            @if (pendingValidationsCount > 0) {
              <ion-badge color="danger" slot="end">{{ pendingValidationsCount }}</ion-badge>
            }
          </ion-item>
          <ion-item button (click)="navigateTo('payments')">
            <ion-icon name="card-outline" slot="start"></ion-icon>
            <ion-label>Payments</ion-label>
          </ion-item>
        </ion-list>
        <ion-list class="bottom-list">
          <ion-item button (click)="backToEvents()">
            <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
            <ion-label>Back to Events</ion-label>
          </ion-item>
          <ion-item button (click)="logout()" class="logout-item">
            <ion-icon name="log-out-outline" slot="start" color="danger"></ion-icon>
            <ion-label color="danger">Logout</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-menu>

    <div id="event-content">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <div class="menu-button-container">
              <ion-menu-button></ion-menu-button>
              @if (pendingValidationsCount > 0) {
                <span class="menu-badge">{{ pendingValidationsCount > 99 ? '99+' : pendingValidationsCount }}</span>
              }
            </div>
          </ion-buttons>
          <ion-title>{{ eventTitle }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <router-outlet></router-outlet>
      </ion-content>
    </div>
  `,
  styles: [`
    ion-toolbar {
      --background: var(--ion-color-primary);
      --color: white;
    }

    ion-menu ion-toolbar {
      --background: var(--ion-color-primary);
      --color: white;
    }

    ion-menu ion-content {
      --background: #f8fafc;
    }

    ion-menu ion-list {
      background: transparent;
      padding: 8px;
    }

    ion-menu ion-item {
      --background: white;
      --border-radius: 8px;
      margin-bottom: 8px;
      --padding-start: 16px;
    }

    ion-menu ion-item ion-icon {
      color: var(--ion-color-primary);
      margin-right: 12px;
    }

    .bottom-list {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }

    .logout-item ion-icon {
      color: var(--ion-color-danger) !important;
    }

    #event-content {
      height: 100%;
    }

    ion-menu-button {
      --color: white;
    }

    .menu-button-container {
      position: relative;
      display: inline-block;
    }

    .menu-badge {
      position: absolute;
      top: 4px;
      right: 0;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 11px;
      font-weight: bold;
      color: white;
      background-color: var(--ion-color-danger);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
  `]
})
export class EventPage implements OnInit, OnDestroy {
  eventId: string = '';
  eventTitle: string = 'Event';
  pendingValidationsCount: number = 0;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private eventService: EventService,
    private menuController: MenuController,
    private webSocketService: WebSocketService,
    private notificationService: NotificationService,
    private registrationService: RegistrationService
  ) {
    addIcons({
      menuOutline,
      logOutOutline,
      receiptOutline,
      checkmarkCircleOutline,
      cardOutline,
      arrowBackOutline
    });
  }

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.loadEventDetails();
    this.loadPendingValidationsCount();
    this.setupGlobalNotifications();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.webSocketService.disconnect();
  }

  private loadPendingValidationsCount(): void {
    this.registrationService.getPendingRegistrations(this.eventId).subscribe({
      next: (registrations) => {
        this.pendingValidationsCount = registrations.length;
        console.log('[EventPage] Loaded pending validations count:', this.pendingValidationsCount);
      },
      error: (err) => {
        console.error('[EventPage] Error loading pending validations:', err);
      }
    });
  }

  private setupGlobalNotifications(): void {
    console.log('[EventPage] Setting up global notifications for eventId:', this.eventId);

    // Request notification permission early
    this.notificationService.requestPermission();

    // Connect WebSocket
    this.webSocketService.connect();

    // Subscribe to validation requests globally - this stays active
    // regardless of which child page (orders, validations, payments) is active
    console.log('[EventPage] Subscribing to validation notifications...');
    const validationSub = this.webSocketService.subscribeToEventValidations(this.eventId)
      .subscribe(notification => {
        console.log('[EventPage] Validation notification received:', notification);
        if (notification.type === 'VALIDATION_REQUESTED') {
          // Increment badge count
          this.pendingValidationsCount++;
          console.log('[EventPage] Pending validations count:', this.pendingValidationsCount);

          // Trigger native push notification
          this.notificationService.showValidationNotification(
            notification.nickname || 'Someone',
            notification.orderPointName || 'Unknown location'
          );
        }
      });
    this.subscriptions.push(validationSub);

    // Subscribe to registration approvals to decrement the count
    const registrationSub = this.webSocketService.subscribeToEventRegistrations(this.eventId)
      .subscribe(notification => {
        console.log('[EventPage] Registration notification received:', notification);
        if (notification.type === 'REGISTRATION_APPROVED') {
          // Decrement badge count
          this.pendingValidationsCount = Math.max(0, this.pendingValidationsCount - 1);
          console.log('[EventPage] Pending validations count after approval:', this.pendingValidationsCount);
        }
      });
    this.subscriptions.push(registrationSub);

    console.log('[EventPage] Subscription set up complete');
  }

  loadEventDetails(): void {
    // For now, just set a placeholder title
    // You can fetch event details from service if needed
    this.eventService.getMyActiveEvents().subscribe({
      next: (events) => {
        const event = events.find(e => e.id === this.eventId);
        if (event) {
          this.eventTitle = `${event.clientName} - ${event.name}`;
        }
      }
    });
  }

  async navigateTo(page: string): Promise<void> {
    await this.menuController.close('event-menu');
    this.router.navigate(['/event', this.eventId, page]);
  }

  async backToEvents(): Promise<void> {
    await this.menuController.close('event-menu');
    this.router.navigate(['/my-events']);
  }

  async logout(): Promise<void> {
    await this.menuController.close('event-menu');
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}