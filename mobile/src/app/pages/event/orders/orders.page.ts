import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  IonContent,
  IonIcon,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { receiptOutline, checkmarkOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { OrderService, Order, OrderItem } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { WebSocketService } from '../../../services/websocket.service';

type OrderStatus = 'ACTIVE' | 'IN_PROGRESS' | 'READY';

interface AggregatedItem {
  key: string;
  name: string;
  quantity: number;
  totalPrice: number;
}

interface TableCard {
  groupId: string;
  orderPointName: string;
  status: string;
  orders: Order[];
  orderNos: number[];
  items: AggregatedItem[];
  total: number;
  assignedUser: string | null;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonRefresher,
    IonRefresherContent
  ],
  template: `
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="segment-wrapper">
        <ion-segment [value]="activeTab" (ionChange)="onTabChange($event)">
          <ion-segment-button value="ACTIVE">
            <ion-label>Ordered ({{ counts.ACTIVE }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="IN_PROGRESS">
            <ion-label>In Progress ({{ counts.IN_PROGRESS }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="READY">
            <ion-label>Ready ({{ counts.READY }})</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      @if (loading) {
        <div class="state-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (myOrderPointIds.length === 0) {
        <div class="state-container">
          <ion-icon name="receipt-outline"></ion-icon>
          <h2>No order points assigned</h2>
          <p>You are not assigned to any pay-later order points for this event.</p>
        </div>
      } @else if (visibleCards.length === 0) {
        <div class="state-container">
          <ion-icon name="receipt-outline"></ion-icon>
          <p>No orders in this column.</p>
        </div>
      } @else {
        <div class="cards">
          @for (card of visibleCards; track card.groupId) {
            <div class="table-card">
              <div class="card-head">
                <div class="head-left">
                  <span class="table-name">{{ card.orderPointName }}</span>
                  <span class="order-nos">#{{ card.orderNos.join(', #') }}</span>
                </div>
                <div class="head-right">
                  @if (card.assignedUser && card.assignedUser !== currentUser) {
                    <span class="assigned-user">{{ card.assignedUser }}</span>
                  }
                  <span class="total">{{ formatPrice(card.total) }}</span>
                </div>
              </div>

              <div class="items">
                @for (item of card.items; track item.key) {
                  <div class="item">
                    <span class="qty">{{ item.quantity }}x</span>
                    <span class="name">{{ item.name }}</span>
                    <span class="price">{{ formatPrice(item.totalPrice) }}</span>
                  </div>
                }
              </div>

              @if (card.status === 'READY') {
                <div class="card-actions">
                  <button class="btn primary" (click)="deliverCard(card)">
                    Deliver <ion-icon name="checkmark-outline"></ion-icon>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    ion-content {
      --background: #ffffff;
    }

    .segment-wrapper {
      padding: 12px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
    }

    ion-segment {
      --background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0;
    }

    ion-segment-button {
      --indicator-color: var(--ion-color-primary);
      --color: #64748b;
      --color-checked: var(--ion-color-primary);
      --border-radius: 0;
      min-height: 36px;
      font-size: 13px;
    }

    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #64748b;
    }

    .state-container ion-icon {
      font-size: 56px;
      margin-bottom: 12px;
      color: #94a3b8;
    }

    .state-container h2 {
      font-size: 17px;
      color: #1e293b;
      margin: 0 0 6px;
    }

    .state-container p {
      margin: 0;
      font-size: 14px;
    }

    .cards {
      padding: 12px;
    }

    .table-card {
      border: 1px solid #e2e8f0;
      margin-bottom: 12px;
      background: #ffffff;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .head-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .table-name {
      font-weight: 700;
      font-size: 16px;
      color: #1e293b;
    }

    .order-nos {
      font-size: 12px;
      color: #64748b;
    }

    .head-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .total {
      font-weight: 700;
      font-size: 15px;
      color: #1e293b;
    }

    .assigned-user {
      font-size: 11px;
      color: #475569;
      background: #e2e8f0;
      padding: 2px 8px;
    }

    .items {
      padding: 8px 12px;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 0;
      font-size: 14px;
    }

    .item .qty {
      min-width: 32px;
      font-weight: 600;
      color: #475569;
    }

    .item .name {
      flex: 1;
      color: #1e293b;
    }

    .item .price {
      color: #475569;
      font-variant-numeric: tabular-nums;
    }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      padding: 8px 12px;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 8px 14px;
      border: 1px solid;
      background: transparent;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 0;
    }

    .btn ion-icon {
      font-size: 16px;
    }

    .btn.primary {
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }
  `]
})
export class OrdersPage implements OnInit, OnDestroy {
  eventId = '';
  currentUser = '';
  loading = true;
  activeTab: OrderStatus = 'ACTIVE';

  orders: Order[] = [];
  myOrderPointIds: string[] = [];
  counts: Record<OrderStatus, number> = { ACTIVE: 0, IN_PROGRESS: 0, READY: 0 };
  cards: Record<OrderStatus, TableCard[]> = { ACTIVE: [], IN_PROGRESS: [], READY: [] };

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private authService: AuthService,
    private ws: WebSocketService
  ) {
    addIcons({ receiptOutline, checkmarkOutline });
  }

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    this.currentUser = this.authService.getUserInfo()?.username || '';
    this.load();
    this.ws.connect();
    this.subs.push(
      this.ws.subscribeToEventOrders(this.eventId).subscribe(() => this.loadOrders())
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  refresh(ev: RefresherCustomEvent): void {
    this.loadOrders(() => ev.target.complete());
  }

  load(): void {
    this.loading = true;
    this.orderService.getEventOrderPoints(this.eventId).subscribe({
      next: (eops) => {
        this.myOrderPointIds = eops
          .filter(e => (e.userLogins || []).includes(this.currentUser))
          .map(e => e.orderPointId);
        this.loadOrders();
      },
      error: () => {
        this.myOrderPointIds = [];
        this.loading = false;
      }
    });
  }

  loadOrders(done?: () => void): void {
    if (this.myOrderPointIds.length === 0) {
      this.orders = [];
      this.regroup();
      this.loading = false;
      done?.();
      return;
    }
    this.orderService.getOrders(this.eventId).subscribe({
      next: (orders) => {
        this.orders = orders.filter(o => this.myOrderPointIds.includes(o.orderPointId));
        this.regroup();
        this.loading = false;
        done?.();
      },
      error: () => {
        this.loading = false;
        done?.();
      }
    });
  }

  private regroup(): void {
    this.cards = {
      ACTIVE: this.groupByTable(this.orders.filter(o => o.status === 'ACTIVE')),
      IN_PROGRESS: this.groupByTable(this.orders.filter(o => o.status === 'IN_PROGRESS')),
      READY: this.groupByTable(this.orders.filter(o => o.status === 'READY'))
    };
    this.counts = {
      ACTIVE: this.cards.ACTIVE.length,
      IN_PROGRESS: this.cards.IN_PROGRESS.length,
      READY: this.cards.READY.length
    };
  }

  private groupByTable(orders: Order[]): TableCard[] {
    const groups = new Map<string, Order[]>();
    for (const o of orders) {
      const key = o.groupId || o.id;
      const existing = groups.get(key);
      if (existing) existing.push(o);
      else groups.set(key, [o]);
    }
    return Array.from(groups.entries()).map(([groupId, group]) => {
      group.sort((a, b) => a.orderNo - b.orderNo);
      const aggregated = new Map<string, AggregatedItem>();
      for (const order of group) {
        for (const item of order.items) {
          if (item.status === 'CANCELLED') continue;
          const key = item.name;
          const existing = aggregated.get(key);
          if (existing) {
            existing.quantity += item.quantity;
            existing.totalPrice += item.price * item.quantity;
          } else {
            aggregated.set(key, {
              key,
              name: item.name,
              quantity: item.quantity,
              totalPrice: item.price * item.quantity
            });
          }
        }
      }
      const items = Array.from(aggregated.values());
      const total = items.reduce((sum, i) => sum + i.totalPrice, 0);
      return {
        groupId,
        orderPointName: group[0]?.orderPointName || 'Unknown',
        status: group[0]?.status || '',
        orders: group,
        orderNos: group.map(o => o.orderNo),
        items,
        total,
        assignedUser: group[0]?.assignedUser ?? null
      };
    });
  }

  get visibleCards(): TableCard[] {
    return this.cards[this.activeTab];
  }

  onTabChange(ev: any): void {
    this.activeTab = ev.detail.value as OrderStatus;
  }

  formatPrice(value: number): string {
    if (value === Math.floor(value)) {
      return `${value.toFixed(0)} RON`;
    }
    return `${value.toFixed(2)} RON`;
  }

  deliverCard(card: TableCard): void {
    forkJoin(card.orders.map(o => this.orderService.setOrderStatus(o.id, 'DELIVERED')))
      .subscribe(() => this.loadOrders());
  }
}
