import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonSpinner,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, personOutline, locationOutline, timeOutline, checkmarkOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { RegistrationService, Registration } from '../../../services/registration.service';
import { WebSocketService } from '../../../services/websocket.service';

@Component({
  selector: 'app-validations',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonSpinner,
    IonBadge,
    IonRefresher,
    IonRefresherContent
  ],
  template: `
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading validations...</p>
        </div>
      } @else if (registrations.length === 0) {
        <div class="empty-container">
          <ion-icon name="checkmark-circle-outline" class="empty-icon"></ion-icon>
          <h2>No Pending Validations</h2>
          <p>All registrations have been validated.</p>
        </div>
      } @else {
        <div class="validations-container">
          <div class="header">
            <h2>Pending Validations</h2>
            <ion-badge color="warning">{{ registrations.length }}</ion-badge>
          </div>

          <ion-list>
            @for (registration of registrations; track registration.id) {
              <ion-item class="validation-item">
                <div class="validation-content">
                  <div class="validation-info">
                    <div class="nickname">
                      <ion-icon name="person-outline"></ion-icon>
                      <span>{{ registration.nickname || 'Anonymous' }}</span>
                    </div>
                    <div class="details">
                      <div class="detail">
                        <ion-icon name="location-outline"></ion-icon>
                        <span>{{ registration.orderPointName }}</span>
                      </div>
                      <div class="detail">
                        <ion-icon name="time-outline"></ion-icon>
                        <span>{{ formatTime(registration.createdAt) }}</span>
                      </div>
                    </div>
                  </div>
                  <ion-button
                    color="success"
                    size="default"
                    (click)="approve(registration)"
                    [disabled]="approvingId === registration.id"
                  >
                    @if (approvingId === registration.id) {
                      <ion-spinner name="crescent"></ion-spinner>
                    } @else {
                      <ion-icon name="checkmark-outline" slot="start"></ion-icon>
                      Approve
                    }
                  </ion-button>
                </div>
              </ion-item>
            }
          </ion-list>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60%;
      color: var(--ion-color-medium);
    }

    .loading-container p {
      margin-top: 16px;
      font-size: 14px;
    }

    .empty-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60%;
      padding: 24px;
      text-align: center;
      color: var(--ion-color-medium);
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      color: var(--ion-color-success);
    }

    .empty-container h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: var(--ion-color-dark);
    }

    .empty-container p {
      margin: 0;
      font-size: 14px;
    }

    .validations-container {
      padding: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--ion-color-dark);
    }

    ion-list {
      background: transparent;
      padding: 0;
    }

    .validation-item {
      --background: white;
      --border-radius: 12px;
      --padding-start: 0;
      --padding-end: 0;
      --inner-padding-end: 0;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .validation-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 16px;
      gap: 12px;
    }

    .validation-info {
      flex: 1;
    }

    .nickname {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--ion-color-dark);
      margin-bottom: 8px;
    }

    .nickname ion-icon {
      font-size: 20px;
      color: var(--ion-color-primary);
    }

    .details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--ion-color-medium);
    }

    .detail ion-icon {
      font-size: 16px;
    }

    ion-button {
      --border-radius: 8px;
      height: 40px;
    }

    ion-button ion-spinner {
      width: 20px;
      height: 20px;
    }
  `]
})
export class ValidationsPage implements OnInit, OnDestroy {
  registrations: Registration[] = [];
  loading = true;
  approvingId: string | null = null;
  eventId: string = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private registrationService: RegistrationService,
    private webSocketService: WebSocketService
  ) {
    addIcons({ checkmarkCircleOutline, personOutline, locationOutline, timeOutline, checkmarkOutline });
  }

  ngOnInit(): void {
    // Get event ID from parent route
    this.eventId = this.route.parent?.snapshot.paramMap.get('id') || '';
    this.loadRegistrations();
    this.setupWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Note: Don't disconnect WebSocket here - EventPage manages the connection
  }

  setupWebSocket(): void {
    // Note: WebSocket connection is managed by EventPage (parent)
    // We only subscribe here for UI updates

    // Subscribe to validation requests for UI updates (reload list)
    const validationSub = this.webSocketService.subscribeToEventValidations(this.eventId)
      .subscribe(notification => {
        console.log('[ValidationsPage] Validation notification:', notification);
        if (notification.type === 'VALIDATION_REQUESTED') {
          // Reload to get the new registration
          // Note: Push notification is triggered by EventPage globally
          this.loadRegistrations();
        }
      });
    this.subscriptions.push(validationSub);

    // Subscribe to registration approvals for UI updates
    const registrationSub = this.webSocketService.subscribeToEventRegistrations(this.eventId)
      .subscribe(notification => {
        console.log('[ValidationsPage] Registration notification:', notification);
        if (notification.type === 'REGISTRATION_APPROVED') {
          // Remove the approved registration from the list
          this.registrations = this.registrations.filter(r => r.id !== notification.registrationId);
        }
      });
    this.subscriptions.push(registrationSub);
  }

  loadRegistrations(): void {
    this.loading = true;
    this.registrationService.getPendingRegistrations(this.eventId).subscribe({
      next: (registrations) => {
        this.registrations = registrations;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading registrations:', err);
        this.registrations = [];
        this.loading = false;
      }
    });
  }

  refresh(event: RefresherCustomEvent): void {
    this.registrationService.getPendingRegistrations(this.eventId).subscribe({
      next: (registrations) => {
        this.registrations = registrations;
        event.target.complete();
      },
      error: () => {
        event.target.complete();
      }
    });
  }

  approve(registration: Registration): void {
    this.approvingId = registration.id;
    this.registrationService.approveRegistration(registration.id).subscribe({
      next: () => {
        // Remove from list (WebSocket will also notify, but this is faster)
        this.registrations = this.registrations.filter(r => r.id !== registration.id);
        this.approvingId = null;
      },
      error: (err) => {
        console.error('Error approving registration:', err);
        this.approvingId = null;
      }
    });
  }

  formatTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}