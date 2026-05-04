import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonIcon,
  IonButtons,
  IonCard,
  IonCardContent,
  IonMenuButton,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, calendarOutline, chevronForwardOutline, menuOutline } from 'ionicons/icons';
import { EventService, Event } from '../../services/event.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-my-events',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonButton,
    IonIcon,
    IonButtons,
    IonCard,
    IonCardContent,
    IonMenuButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button autoHide="false"></ion-menu-button>
        </ion-buttons>
        <ion-title>Active Events</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading events...</p>
        </div>
      } @else if (events.length === 0) {
        <div class="empty-container">
          <ion-icon name="calendar-outline" class="empty-icon"></ion-icon>
          <h2>No Active Events</h2>
          <p>You don't have any events running right now.</p>
        </div>
      } @else {
        <div class="events-container">
          @for (event of events; track event.id) {
            <ion-card class="event-card" (click)="openEvent(event)" button>
              <ion-card-content>
                <div class="event-row">
                  <div class="event-info">
                    <div class="event-title">{{ event.clientName }} - {{ event.name }}</div>
                    <div class="event-date">{{ formatDate(event.startDate) }} - {{ formatDate(event.endDate) }}</div>
                  </div>
                  <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
                </div>
              </ion-card-content>
            </ion-card>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    ion-toolbar {
      --background: #ffffff;
      --color: #1e293b;
      --border-color: #e2e8f0;
      --border-width: 0 0 1px 0;
      --border-style: solid;
    }

    ion-toolbar ion-button,
    ion-toolbar ion-menu-button {
      --color: #1e293b;
      color: #1e293b;
    }

    ion-content {
      --background: #ffffff;
    }

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
      color: var(--ion-color-medium);
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

    .events-container {
      padding: 16px;
    }

    .event-card {
      margin: 0 0 12px 0;
      border-radius: 0;
      box-shadow: none;
      border: 1px solid #e2e8f0;
      cursor: pointer;
    }

    .event-card:active {
      transform: scale(0.98);
    }

    ion-card-content {
      padding: 16px;
    }

    .event-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .event-info {
      flex: 1;
    }

    .event-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--ion-color-dark);
      margin-bottom: 4px;
    }

    .event-date {
      font-size: 13px;
      color: var(--ion-color-medium);
    }

    .chevron {
      font-size: 20px;
      color: var(--ion-color-medium);
    }
  `]
})
export class MyEventsPage implements OnInit {
  events: Event[] = [];
  loading = true;

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ logOutOutline, calendarOutline, chevronForwardOutline });
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;
    this.eventService.getMyActiveEvents().subscribe({
      next: (events) => {
        this.events = events;
        this.loading = false;
      },
      error: () => {
        this.events = [];
        this.loading = false;
      }
    });
  }

  refresh(event: RefresherCustomEvent): void {
    this.eventService.getMyActiveEvents().subscribe({
      next: (events) => {
        this.events = events;
        event.target.complete();
      },
      error: () => {
        this.events = [];
        event.target.complete();
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openEvent(event: Event): void {
    this.router.navigate(['/event', event.id]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}