import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonIcon,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { storefrontOutline, gitBranchOutline } from 'ionicons/icons';
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
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonText,
    IonIcon
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
        <div class="tables-grid">
          @for (table of myTables; track table.id) {
            <button type="button" class="table-tile" (click)="openAddOrder(table)">
              @if (table.payLater) {
                <span
                  class="split-btn"
                  role="button"
                  aria-label="Split table"
                  (click)="askSplit(table, $event)"
                >
                  <ion-icon name="git-branch-outline"></ion-icon>
                </span>
              }
              @if (table.credit) {
                <span class="credit-badge">Credit</span>
              }
              <span class="tile-name">{{ table.orderPointName }}</span>
            </button>
          }
        </div>
      }
    </ion-content>

    @if (splitTarget) {
      <div class="confirm-backdrop" (click)="cancelSplit()">
        <div class="confirm-sheet" (click)="$event.stopPropagation()">
          <div class="confirm-question">Are you sure you want to start a new Table?</div>
          <div class="confirm-row">
            <button class="confirm-btn no" [disabled]="splitting" (click)="cancelSplit()">No</button>
            <button class="confirm-btn yes" [disabled]="splitting" (click)="confirmSplit()">
              @if (splitting) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                Yes
              }
            </button>
          </div>
        </div>
      </div>
    }
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

    .tables-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 12px;
    }

    .table-tile {
      position: relative;
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      border: 1px solid var(--ion-color-primary);
      background: #ffffff;
      color: var(--ion-color-primary);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      border-radius: 0;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .table-tile:active {
      background: var(--ion-color-primary);
      color: #ffffff;
    }

    .tile-name {
      text-align: center;
      word-break: break-word;
    }

    .credit-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #ffffff;
      background: var(--ion-color-success, #16a34a);
      border-radius: 999px;
    }

    .split-btn {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.06);
      color: var(--ion-color-primary);
      cursor: pointer;
    }

    .split-btn ion-icon {
      font-size: 16px;
    }

    .table-tile:active .split-btn {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }

    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 2000;
    }

    .confirm-sheet {
      width: 100%;
      max-width: 480px;
      background: #ffffff;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      padding: 20px 16px 24px;
      box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.12);
    }

    .confirm-question {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      text-align: center;
      padding-bottom: 16px;
    }

    .confirm-row {
      display: flex;
      gap: 8px;
    }

    .confirm-btn {
      flex: 1;
      padding: 14px;
      border: 1px solid;
      background: transparent;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border-radius: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .confirm-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .confirm-btn.no {
      color: #475569;
      border-color: #cbd5e1;
    }

    .confirm-btn.yes {
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }
  `]
})
export class TablesPage implements OnInit {
  eventId: string = '';
  myTables: EventOrderPoint[] = [];
  loading = true;
  currentUsername: string = '';

  /** OP being split (when non-null, the confirm sheet is open). */
  splitTarget: EventOrderPoint | null = null;
  splitting = false;

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private authService: AuthService,
    private modalController: ModalController
  ) {
    addIcons({ storefrontOutline, gitBranchOutline });
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

  /** Tile's split affordance — stop the tap from also opening Add Order. */
  askSplit(table: EventOrderPoint, event: globalThis.Event): void {
    event.stopPropagation();
    if (this.splitting) return;
    this.splitTarget = table;
  }

  cancelSplit(): void {
    if (this.splitting) return;
    this.splitTarget = null;
  }

  confirmSplit(): void {
    const target = this.splitTarget;
    if (!target || this.splitting) return;
    this.splitting = true;
    this.orderService.splitEventOrderPoint(this.eventId, target.orderPointId).subscribe({
      next: () => {
        this.splitting = false;
        this.splitTarget = null;
        this.loadTables();
      },
      error: (err) => {
        console.error('Failed to split order point:', err);
        this.splitting = false;
        this.splitTarget = null;
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