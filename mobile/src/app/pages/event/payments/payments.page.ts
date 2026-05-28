import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  cashOutline,
  walletOutline,
  closeOutline,
  storefrontOutline,
  documentTextOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { OrderService, Order, EventOrderPoint } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { WebSocketService } from '../../../services/websocket.service';

interface TableGroup {
  orderPointId: string;
  orderPointName: string;
  orders: Order[];
  total: number;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent
  ],
  template: `
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="state-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (myOrderPointIds.length === 0) {
        <div class="state-container">
          <ion-icon name="wallet-outline"></ion-icon>
          <h2>No order points assigned</h2>
          <p>You are not assigned to any pay-later order points for this event.</p>
        </div>
      } @else if (tableGroups.length === 0) {
        <div class="state-container">
          <ion-icon name="wallet-outline"></ion-icon>
          <p>No orders awaiting payment.</p>
        </div>
      } @else {
        <div class="tables">
          @for (table of tableGroups; track table.orderPointId) {
            <div class="table-card">
              <div class="table-head">
                <span class="table-name">{{ table.orderPointName }}</span>
                <div class="table-head-right">
                  <span class="table-total">{{ formatPrice(table.total) }}</span>
                  <button class="pay-table-btn" (click)="openPaymentModal(table.orders)">
                    Pay all
                  </button>
                </div>
              </div>

              @for (order of table.orders; track order.id) {
                <div class="order-block">
                  <div class="order-head">
                    <div class="order-meta">
                      <span class="order-no">#{{ order.orderNo }}</span>
                      @if (order.nickname) {
                        <span class="nickname">{{ order.nickname }}</span>
                      }
                    </div>
                    <div class="order-head-right">
                      <span class="order-total">{{ formatPrice(orderTotal(order)) }}</span>
                      <button class="pay-order-btn" (click)="openPaymentModal([order])">
                        Pay
                      </button>
                    </div>
                  </div>

                  <div class="items">
                    @for (item of activeItems(order); track item.id) {
                      <div class="item">
                        <span class="qty">{{ item.quantity }}x</span>
                        <span class="name">{{ item.name }}</span>
                        <span class="price">{{ formatPrice(item.price * item.quantity) }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </ion-content>

    @if (showPaymentModal) {
      <div class="modal-overlay" (click)="closePaymentModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>Select Payment Method</h3>
            <button class="modal-close" (click)="closePaymentModal()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>

          <div class="modal-summary">
            <span>{{ pendingOrders.length }} {{ pendingOrders.length === 1 ? 'order' : 'orders' }}</span>
            <span class="modal-total">{{ formatPrice(pendingTotal) }}</span>
          </div>

          <div class="section-label">Payment method</div>
          <div class="method-row">
            <button
              class="method-btn cash"
              [disabled]="busy"
              (click)="confirmPayment('CASH')">
              <ion-icon name="cash-outline"></ion-icon> Cash
            </button>
            <button
              class="method-btn card"
              [disabled]="busy"
              (click)="confirmPayment('CARD')">
              <ion-icon name="card-outline"></ion-icon> Card
            </button>
            <button
              class="method-btn protocol"
              [disabled]="busy"
              (click)="confirmPayment('PROTOCOL')">
              <ion-icon name="document-text-outline"></ion-icon> Protocol
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    ion-content {
      --background: #ffffff;
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

    .tables {
      padding: 12px;
    }

    .table-card {
      border: 1px solid #e2e8f0;
      margin-bottom: 16px;
      background: #ffffff;
    }

    .table-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .table-head-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .table-name {
      font-weight: 700;
      font-size: 16px;
      color: #1e293b;
    }

    .table-total {
      font-weight: 700;
      font-size: 15px;
      color: #1e293b;
    }

    .pay-table-btn {
      padding: 6px 14px;
      border: 1px solid var(--ion-color-primary);
      background: transparent;
      color: var(--ion-color-primary);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border-radius: 0;
    }

    .order-block {
      border-bottom: 1px solid #f1f5f9;
      padding: 10px 12px;
    }

    .order-block:last-child {
      border-bottom: none;
    }

    .order-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .order-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .order-head-right {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .order-no {
      font-weight: 600;
      color: #1e293b;
      font-size: 14px;
    }

    .nickname {
      font-size: 12px;
      color: #64748b;
      font-style: italic;
    }

    .order-total {
      font-weight: 600;
      color: #475569;
      font-size: 14px;
    }

    .pay-order-btn {
      padding: 4px 12px;
      border: 1px solid #cbd5e1;
      background: transparent;
      color: #475569;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      border-radius: 0;
    }

    .items {
      padding-bottom: 4px;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 2px 0;
      font-size: 13px;
    }

    .item .qty {
      min-width: 28px;
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

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      display: flex;
      justify-content: center;
      align-items: flex-end;
      z-index: 9999;
      padding: 0;
    }

    .modal {
      background: #ffffff;
      width: 100%;
      max-width: 560px;
      border: 1px solid #e2e8f0;
      border-radius: 0;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-head h3 {
      margin: 0;
      font-size: 16px;
      color: #1e293b;
      font-weight: 700;
    }

    .modal-close {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
    }

    .modal-close ion-icon {
      font-size: 22px;
    }

    .modal-summary {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
      color: #1e293b;
    }

    .modal-total {
      font-weight: 700;
    }

    .section-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      padding: 12px 16px 6px;
    }

    .method-row {
      display: flex;
      gap: 8px;
      padding: 0 16px 16px;
    }

    .method-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px;
      border: 1px solid;
      background: transparent;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 0;
    }

    .method-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .method-btn ion-icon {
      font-size: 18px;
    }

    .method-btn.cash {
      color: #16a34a;
      border-color: #16a34a;
    }

    .method-btn.card {
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }

    .method-btn.protocol {
      color: #b45309;
      border-color: #f59e0b;
    }
  `]
})
export class PaymentsPage implements OnInit, OnDestroy {
  eventId = '';
  currentUser = '';
  loading = true;

  myOrderPointIds: string[] = [];
  needsPaymentOrders: Order[] = [];
  tableGroups: TableGroup[] = [];

  // OP id → assigned cash register id (from Edit Event → Order Points).
  // The bulk-paid endpoint forwards this to the cash-register listener;
  // backend gracefully falls back to the event's first CR when null.
  private cashRegisterByOrderPointId = new Map<string, string>();
  selectedCashRegisterDeviceId: string | null = null;

  showPaymentModal = false;
  pendingOrders: Order[] = [];
  pendingTotal = 0;
  busy = false;

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private authService: AuthService,
    private ws: WebSocketService
  ) {
    addIcons({ cardOutline, cashOutline, walletOutline, closeOutline, storefrontOutline, documentTextOutline });
  }

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    this.currentUser = this.authService.getUserInfo()?.username || '';
    this.load();
    this.ws.connect();
    this.subs.push(
      this.ws.subscribeToEventPayments(this.eventId).subscribe(() => this.loadNeedsPayment()),
      this.ws.subscribeToEventOrders(this.eventId).subscribe(() => this.loadNeedsPayment())
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  refresh(ev: RefresherCustomEvent): void {
    this.loadNeedsPayment(() => ev.target.complete());
  }

  load(): void {
    this.loading = true;
    this.orderService.getEventOrderPoints(this.eventId).subscribe({
      next: (eops: EventOrderPoint[]) => {
        this.myOrderPointIds = eops
          .filter(e => (e.userLogins || []).includes(this.currentUser))
          .map(e => e.orderPointId);
        this.cashRegisterByOrderPointId.clear();
        for (const eop of eops) {
          if (eop.cashRegisterId) {
            this.cashRegisterByOrderPointId.set(eop.orderPointId, eop.cashRegisterId);
          }
        }
        this.loadNeedsPayment();
      },
      error: () => {
        this.myOrderPointIds = [];
        this.loading = false;
      }
    });
  }

  loadNeedsPayment(done?: () => void): void {
    if (this.myOrderPointIds.length === 0) {
      this.needsPaymentOrders = [];
      this.tableGroups = [];
      this.loading = false;
      done?.();
      return;
    }
    this.orderService.getOrdersNeedingPayment(this.eventId).subscribe({
      next: (orders) => {
        this.needsPaymentOrders = orders.filter(o => this.myOrderPointIds.includes(o.orderPointId));
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
    const map = new Map<string, TableGroup>();
    for (const order of this.needsPaymentOrders) {
      let g = map.get(order.orderPointId);
      if (!g) {
        g = { orderPointId: order.orderPointId, orderPointName: order.orderPointName, orders: [], total: 0 };
        map.set(order.orderPointId, g);
      }
      g.orders.push(order);
      g.total += this.orderTotal(order);
    }
    this.tableGroups = Array.from(map.values()).sort((a, b) =>
      a.orderPointName.localeCompare(b.orderPointName)
    );
  }

  activeItems(order: Order) {
    return order.items.filter(i => i.status !== 'CANCELLED' && !i.paid);
  }

  orderTotal(order: Order): number {
    return this.activeItems(order).reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  formatPrice(value: number): string {
    if (value === Math.floor(value)) {
      return `${value.toFixed(0)} RON`;
    }
    return `${value.toFixed(2)} RON`;
  }

  openPaymentModal(orders: Order[]): void {
    if (this.busy) return;
    this.pendingOrders = orders;
    this.pendingTotal = orders.reduce((sum, o) => sum + this.orderTotal(o), 0);
    // Resolve the cash register from the OP's assignment (Edit Event →
    // Order Points). Backend gracefully falls back to the event's first
    // CR when null, so we don't need to load the CR list ourselves.
    const opId = orders[0]?.orderPointId;
    this.selectedCashRegisterDeviceId = opId ? this.cashRegisterByOrderPointId.get(opId) ?? null : null;
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.pendingOrders = [];
    this.pendingTotal = 0;
  }

  confirmPayment(method: 'CASH' | 'CARD' | 'PROTOCOL'): void {
    if (this.busy) return;
    const orders = this.pendingOrders;
    const deviceId = this.selectedCashRegisterDeviceId;
    if (orders.length === 0) {
      this.closePaymentModal();
      return;
    }

    this.busy = true;

    // One bulk request — backend marks the orders paid AND fires the
    // cash-register print via PaymentCompletedEvent (same mechanism as
    // the Netopia callback). PROTOCOL skips the fiscal print.
    this.orderService.bulkMarkPaid({
      orderIds: orders.map(o => o.id),
      paymentMethod: method,
      paidBy: this.currentUser,
      cashRegisterDeviceId: deviceId
    }).subscribe({
      next: () => {
        this.busy = false;
        this.closePaymentModal();
        this.loadNeedsPayment();
      },
      error: (err) => {
        console.error('[Payments] bulk mark paid failed:', err);
        this.busy = false;
        this.closePaymentModal();
        this.loadNeedsPayment();
      }
    });
  }
}
