import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterOutlet } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonMenu,
  IonMenuButton,
  IonList,
  IonItem,
  IonLabel,
  MenuController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  receiptOutline,
  cardOutline,
  arrowBackOutline
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { EventService } from '../../services/event.service';
import { WebSocketService } from '../../services/websocket.service';

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
    IonIcon,
    IonButtons,
    IonMenu,
    IonMenuButton,
    IonList,
    IonItem,
    IonLabel
  ],
  template: `
    <ion-menu contentId="event-content" menuId="event-menu">
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-title>Menu</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list lines="none">
          <ion-item button (click)="navigateTo('orders')">
            <ion-icon name="receipt-outline" slot="start"></ion-icon>
            <ion-label>Orders</ion-label>
          </ion-item>
          <ion-item button (click)="navigateTo('payments')">
            <ion-icon name="card-outline" slot="start"></ion-icon>
            <ion-label>Payments</ion-label>
          </ion-item>
        </ion-list>
        <ion-list lines="none" class="bottom-list">
          <ion-item button (click)="backToEvents()">
            <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
            <ion-label>Back to Events</ion-label>
          </ion-item>
          <ion-item button (click)="logout()">
            <ion-icon name="log-out-outline" slot="start"></ion-icon>
            <ion-label>Logout</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-menu>

    <div id="event-content">
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-menu-button menu="event-menu" autoHide="false"></ion-menu-button>
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
      --background: #ffffff;
      --color: #1e293b;
      --border-color: #e2e8f0;
      --border-width: 0 0 1px 0;
      --border-style: solid;
    }

    ion-toolbar ion-menu-button {
      --color: #1e293b;
      color: #1e293b;
    }

    ion-menu ion-toolbar {
      --background: #ffffff;
      --color: #1e293b;
      --border-color: #e2e8f0;
      --border-width: 0 0 1px 0;
      --border-style: solid;
    }

    ion-menu ion-content {
      --background: #ffffff;
    }

    ion-menu ion-item {
      --background: #ffffff;
      --color: #1e293b;
    }

    .bottom-list {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #e2e8f0;
    }

    #event-content {
      height: 100%;
    }

    ion-content {
      --background: #ffffff;
    }
  `]
})
export class EventPage implements OnInit, OnDestroy {
  eventId: string = '';
  eventTitle: string = 'Event';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private eventService: EventService,
    private menuController: MenuController,
    private webSocketService: WebSocketService
  ) {
    addIcons({
      logOutOutline,
      receiptOutline,
      cardOutline,
      arrowBackOutline
    });
  }

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.loadEventDetails();
    this.webSocketService.connect();
  }

  ngOnDestroy(): void {
    this.webSocketService.disconnect();
  }

  loadEventDetails(): void {
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