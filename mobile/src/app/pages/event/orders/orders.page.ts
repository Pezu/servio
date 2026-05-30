import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
  RefresherCustomEvent,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { receiptOutline, checkmarkOutline, timeOutline, checkmarkCircleOutline, archiveOutline, warningOutline, refreshOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { OrderService, Order, OrderItem, FiscalReceipt } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { WebSocketService } from '../../../services/websocket.service';

type OrderTab = 'ACTIVE' | 'IN_PROGRESS' | 'READY' | 'CLOSED';

interface AggregatedItem {
  key: string;
  name: string;
  quantity: number;
  totalPrice: number;
}

interface TableCard {
  groupId: string;
  orderPointId: string;
  orderPointName: string;
  status: string;
  orders: Order[];
  orderNos: number[];
  items: AggregatedItem[];
  total: number;
  assignedUser: string | null;
  /** FAILED fiscal receipts touching this card (one per partial installment). */
  failedReceipts: FiscalReceipt[];
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
          <ion-segment-button value="ACTIVE" title="Ordered">
            <ion-icon name="receipt-outline"></ion-icon>
            <ion-label>{{ counts.ACTIVE }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="IN_PROGRESS" title="In Progress">
            <ion-icon name="time-outline"></ion-icon>
            <ion-label>{{ counts.IN_PROGRESS }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="READY" title="Ready">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
            <ion-label>{{ counts.READY }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="CLOSED" title="Closed">
            <ion-icon name="archive-outline"></ion-icon>
            <ion-label>{{ counts.CLOSED }}</ion-label>
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
                    <span class="name" [innerHTML]="safeHtml(item.name)"></span>
                    <span class="price">{{ formatPrice(item.totalPrice) }}</span>
                  </div>
                }
              </div>

              @if (card.failedReceipts.length > 0) {
                <div class="fiscal-failed">
                  <div class="fiscal-failed-msg">
                    <ion-icon name="warning-outline"></ion-icon>
                    <span>Fiscal receipt not issued — the order is paid, but the printer did not print the receipt.</span>
                  </div>
                  <button class="btn warn" [disabled]="isRetrying(card)" (click)="retryFiscal(card)">
                    @if (isRetrying(card)) {
                      <ion-spinner name="crescent"></ion-spinner> Retrying...
                    } @else {
                      Retry receipt <ion-icon name="refresh-outline"></ion-icon>
                    }
                  </button>
                </div>
              }

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
      min-height: 44px;
      font-size: 12px;
    }

    ion-segment-button ion-icon {
      font-size: 20px;
      margin-bottom: 2px;
    }

    ion-segment-button ion-label {
      font-size: 12px;
      font-weight: 600;
      margin: 0;
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

    .item .name font[size="1"] {
      font-size: 11px;
      font-weight: 500;
      opacity: 0.7;
      margin-left: 4px;
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

    .btn.warn {
      color: #b45309;
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .btn.warn:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .btn.warn ion-spinner {
      width: 16px;
      height: 16px;
    }

    .fiscal-failed {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-top: 1px solid #fde68a;
      background: #fffdf5;
    }

    .fiscal-failed-msg {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #92400e;
      flex: 1;
      min-width: 0;
    }

    .fiscal-failed .btn.warn {
      flex-shrink: 0;
      white-space: nowrap;
    }

    .fiscal-failed-msg ion-icon {
      font-size: 18px;
      flex-shrink: 0;
      color: #f59e0b;
    }
  `]
})
export class OrdersPage implements OnInit, OnDestroy {
  eventId = '';
  currentUser = '';
  loading = true;
  activeTab: OrderTab = 'ACTIVE';

  orders: Order[] = [];
  closedOrders: Order[] = [];
  /** Closed orders are fetched lazily the first time the Closed tab is opened. */
  private closedLoaded = false;
  myOrderPointIds: string[] = [];
  counts: Record<OrderTab, number> = { ACTIVE: 0, IN_PROGRESS: 0, READY: 0, CLOSED: 0 };
  cards: Record<OrderTab, TableCard[]> = { ACTIVE: [], IN_PROGRESS: [], READY: [], CLOSED: [] };

  private subs: Subscription[] = [];
  private readonly safeHtmlCache = new Map<string, SafeHtml>();
  // orderId → FAILED fiscal receipts touching it. Loaded separately from orders
  // (a receipt can span several orders / be one of several partial installments).
  private failedReceiptsByOrderId = new Map<string, FiscalReceipt[]>();
  /** Card groupIds currently being re-fiscalized — drives the button spinner. */
  retryingGroupIds = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private authService: AuthService,
    private ws: WebSocketService,
    private sanitizer: DomSanitizer,
    private toastController: ToastController
  ) {
    addIcons({ receiptOutline, checkmarkOutline, timeOutline, checkmarkCircleOutline, archiveOutline, warningOutline, refreshOutline });
  }

  /**
   * Item names sometimes contain HTML the menu admin wrote (e.g.
   * {@code <font size="1">0.7L</font>}). Trust it and render with innerHTML;
   * cache the SafeHtml so change detection doesn't re-bypass each tick.
   */
  safeHtml(value: string | null | undefined): SafeHtml {
    const text = value ?? '';
    let cached = this.safeHtmlCache.get(text);
    if (!cached) {
      cached = this.sanitizer.bypassSecurityTrustHtml(text);
      this.safeHtmlCache.set(text, cached);
    }
    return cached;
  }

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    this.currentUser = this.authService.getUserInfo()?.username || '';
    this.load();
    this.ws.connect();
    this.subs.push(
      this.ws.subscribeToEventOrders(this.eventId).subscribe(() => {
        this.loadOrders();
        this.loadFailedReceipts();
        // Keep the Closed tab fresh once it's been opened (e.g. an order just
        // got delivered elsewhere).
        if (this.closedLoaded) this.loadClosedOrders();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  refresh(ev: RefresherCustomEvent): void {
    this.loadFailedReceipts();
    if (this.activeTab === 'CLOSED') {
      this.loadClosedOrders(() => ev.target.complete());
    } else {
      this.loadOrders(() => ev.target.complete());
    }
  }

  load(): void {
    this.loading = true;
    this.orderService.getEventOrderPoints(this.eventId).subscribe({
      next: (eops) => {
        this.myOrderPointIds = eops
          .filter(e => (e.userLogins || []).includes(this.currentUser))
          .map(e => e.orderPointId);
        this.loadFailedReceipts();
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

  /** Loads FAILED fiscal receipts for the event and re-groups so cards show the banner. */
  loadFailedReceipts(done?: () => void): void {
    this.orderService.getFailedFiscalReceipts(this.eventId).subscribe({
      next: (receipts) => {
        const map = new Map<string, FiscalReceipt[]>();
        for (const r of receipts) {
          for (const orderId of r.orderIds) {
            const list = map.get(orderId) ?? [];
            list.push(r);
            map.set(orderId, list);
          }
        }
        this.failedReceiptsByOrderId = map;
        this.regroup();
        done?.();
      },
      error: () => done?.()
    });
  }

  loadClosedOrders(done?: () => void): void {
    this.closedLoaded = true;
    if (this.myOrderPointIds.length === 0) {
      this.closedOrders = [];
      this.regroup();
      done?.();
      return;
    }
    this.orderService.getClosedOrders(this.eventId).subscribe({
      next: (orders) => {
        this.closedOrders = orders.filter(o => this.myOrderPointIds.includes(o.orderPointId));
        this.regroup();
        done?.();
      },
      error: () => done?.()
    });
  }

  private regroup(): void {
    this.cards = {
      ACTIVE: this.groupByTable(this.orders.filter(o => o.status === 'ACTIVE')),
      IN_PROGRESS: this.groupByTable(this.orders.filter(o => o.status === 'IN_PROGRESS')),
      READY: this.groupByTable(this.orders.filter(o => o.status === 'READY')),
      // Closed = delivered/completed orders, fetched separately (the active
      // orders endpoint excludes DELIVERED).
      CLOSED: this.groupByTable(this.closedOrders)
    };
    this.counts = {
      ACTIVE: this.cards.ACTIVE.length,
      IN_PROGRESS: this.cards.IN_PROGRESS.length,
      READY: this.cards.READY.length,
      CLOSED: this.cards.CLOSED.length
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
      // Collect FAILED receipts touching this card's orders, deduped by requestId
      // (one receipt can span several orders in the group).
      const failedMap = new Map<string, FiscalReceipt>();
      for (const o of group) {
        for (const r of (this.failedReceiptsByOrderId.get(o.id) ?? [])) {
          failedMap.set(r.requestId, r);
        }
      }
      return {
        groupId,
        orderPointId: group[0]?.orderPointId || '',
        orderPointName: group[0]?.orderPointName || 'Unknown',
        status: group[0]?.status || '',
        orders: group,
        orderNos: group.map(o => o.orderNo),
        items,
        total,
        assignedUser: group[0]?.assignedUser ?? null,
        failedReceipts: Array.from(failedMap.values())
      };
    });
  }

  get visibleCards(): TableCard[] {
    return this.cards[this.activeTab];
  }

  onTabChange(ev: any): void {
    this.activeTab = ev.detail.value as OrderTab;
    if (this.activeTab === 'CLOSED' && !this.closedLoaded) {
      this.loadClosedOrders();
    }
  }

  formatPrice(value: number): string {
    if (value === Math.floor(value)) {
      return `${value.toFixed(0)} RON`;
    }
    return `${value.toFixed(2)} RON`;
  }

  deliverCard(card: TableCard): void {
    forkJoin(card.orders.map(o => this.orderService.setOrderStatus(o.id, 'DELIVERED')))
      .subscribe(() => {
        this.loadOrders();
        if (this.closedLoaded) this.loadClosedOrders();
      });
  }

  isRetrying(card: TableCard): boolean {
    return this.retryingGroupIds.has(card.groupId);
  }

  /**
   * Re-print the FAILED fiscal receipt(s) for this card. Does NOT re-charge —
   * the orders stay paid. Each failed receipt is retried by its requestId, so a
   * partial receipt re-fiscalizes only its own items. Replies land async, so we
   * refresh the failed-receipts list shortly after.
   */
  retryFiscal(card: TableCard): void {
    if (card.failedReceipts.length === 0 || this.isRetrying(card)) return;
    this.retryingGroupIds.add(card.groupId);
    const calls = card.failedReceipts.map(r =>
      this.orderService.retryReceipt({ requestId: r.requestId }));
    forkJoin(calls).subscribe({
      next: (responses) => {
        const firstError = responses.find(res => res.status === 'ERROR');
        if (firstError) {
          this.retryingGroupIds.delete(card.groupId);
          this.showToast(firstError.errorMessage || 'Retry failed.', 'danger');
          this.loadFailedReceipts();
          return;
        }
        this.showToast(
          responses.length > 1 ? 'Receipts re-sent to the cash register.'
                               : 'Receipt re-sent to the cash register.', 'medium');
        // Device replies land async; give them a moment, then refresh status.
        setTimeout(() => {
          this.retryingGroupIds.delete(card.groupId);
          this.loadFailedReceipts();
        }, 2500);
      },
      error: (err) => {
        this.retryingGroupIds.delete(card.groupId);
        this.showToast('Retry failed. Check the cash register.', 'danger');
        console.error('Retry fiscal receipt failed:', err);
      }
    });
  }

  private async showToast(message: string, color: 'medium' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }
}
