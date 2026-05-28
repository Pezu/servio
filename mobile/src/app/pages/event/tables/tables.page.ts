import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonIcon,
  IonBadge,
  IonButton,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { storefrontOutline, addOutline } from 'ionicons/icons';
import { OrderService, EventOrderPoint } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { AddOrderModal } from './add-order.modal';

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonText,
    IonIcon,
    IonBadge,
    IonButton
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>My Tables</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (myTables.length === 0) {
        <div class="empty-state">
          <ion-icon name="storefront-outline" class="empty-icon"></ion-icon>
          <ion-text color="medium">
            <p>No tables assigned to you</p>
          </ion-text>
        </div>
      } @else {
        <ion-list>
          @for (table of myTables; track table.id) {
            <ion-item>
              <ion-icon name="storefront-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h2>{{ table.orderPointName }}</h2>
              </ion-label>
              @if (table.credit) {
                <ion-badge color="success">Credit</ion-badge>
              }
              <ion-button fill="clear" slot="end" (click)="openAddOrder(table)">
                <ion-icon name="add-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100%;
      text-align: center;
      padding: 24px;
    }

    .empty-icon {
      font-size: 64px;
      color: var(--ion-color-medium);
      margin-bottom: 16px;
    }

    ion-item h2 {
      font-weight: 600;
    }

    ion-item ion-badge {
      margin-right: 8px;
    }
  `]
})
export class TablesPage implements OnInit {
  eventId: string = '';
  myTables: EventOrderPoint[] = [];
  loading = true;
  currentUsername: string = '';

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private authService: AuthService,
    private modalController: ModalController
  ) {
    addIcons({ storefrontOutline, addOutline });
  }

  ngOnInit() {
    this.eventId = this.route.parent?.snapshot.paramMap.get('id') || '';
    const userInfo = this.authService.getUserInfo();
    this.currentUsername = userInfo?.username || '';
    this.loadTables();
  }

  loadTables() {
    this.loading = true;
    this.orderService.getEventOrderPoints(this.eventId).subscribe({
      next: (orderPoints) => {
        this.myTables = orderPoints.filter(op => (op.userLogins || []).includes(this.currentUsername));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load tables:', err);
        this.loading = false;
      }
    });
  }

  doRefresh(event: any) {
    this.orderService.getEventOrderPoints(this.eventId).subscribe({
      next: (orderPoints) => {
        this.myTables = orderPoints.filter(op => (op.userLogins || []).includes(this.currentUsername));
        event.target.complete();
      },
      error: () => {
        event.target.complete();
      }
    });
  }

  async openAddOrder(table: EventOrderPoint) {
    const modal = await this.modalController.create({
      component: AddOrderModal,
      componentProps: {
        table,
        eventId: this.eventId
      }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data?.success) {
      // Order was created successfully
      console.log('Order created:', data.order);
    }
  }
}