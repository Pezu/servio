import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonBadge,
  IonRefresher,
  IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  receiptOutline,
  checkmarkCircle,
  closeCircle,
  playOutline,
  checkmarkOutline,
  returnDownBackOutline,
  checkmarkDoneOutline,
  alertCircleOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { WebSocketService } from '../../../services/websocket.service';
import { environment } from '../../../../environments/environment';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: 'ORDERED' | 'PREPARING' | 'DONE' | 'CANCELLED';
  note?: string;
  paid?: boolean;
}

interface Order {
  id: string;
  orderNo: number;
  registrationId: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  status: string;
  assignedUser: string | null;
  note?: string;
  needsPayment: boolean;
  nickname?: string;
  items: OrderItem[];
}

type TabKey = 'ordered' | 'inProgress' | 'ready';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonBadge,
    IonRefresher,
    IonRefresherContent
  ],
  template: `
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Tabs -->
      <div class="tabs-container">
        <button
          class="tab-button"
          [class.active]="activeTab === 'ordered'"
          (click)="activeTab = 'ordered'"
        >
          <span class="tab-label">Ordered</span>
          <ion-badge [color]="activeTab === 'ordered' ? 'light' : 'primary'">
            {{ orderedOrders.length }}
          </ion-badge>
        </button>
        <button
          class="tab-button tab-in-progress"
          [class.active]="activeTab === 'inProgress'"
          (click)="activeTab = 'inProgress'"
        >
          <span class="tab-label">In Progress</span>
          <ion-badge [color]="activeTab === 'inProgress' ? 'light' : 'warning'">
            {{ inProgressOrders.length }}
          </ion-badge>
        </button>
        <button
          class="tab-button tab-ready"
          [class.active]="activeTab === 'ready'"
          (click)="activeTab = 'ready'"
        >
          <span class="tab-label">Ready</span>
          <ion-badge [color]="activeTab === 'ready' ? 'light' : 'success'">
            {{ readyOrders.length }}
          </ion-badge>
        </button>
      </div>

      <!-- Order Cards -->
      <div class="orders-list">
        @if (loading) {
          <div class="placeholder">
            <p>Loading orders...</p>
          </div>
        } @else if (currentOrders.length === 0) {
          <div class="placeholder">
            <ion-icon name="receipt-outline"></ion-icon>
            <p>No orders in this category</p>
          </div>
        } @else {
          @for (order of currentOrders; track order.id) {
            <div class="order-card">
              <!-- Order Header -->
              <div class="order-header">
                <div class="order-header-left">
                  <span class="order-number">#{{ order.orderNo }}</span>
                  <span class="order-point">{{ order.orderPointName }}</span>
                </div>
                <div class="order-header-right">
                  @if (order.nickname) {
                    <span class="order-nickname">{{ order.nickname }}</span>
                  }
                  <span class="order-total">{{ getOrderTotal(order) | currency:'RON':'symbol':'1.2-2' }}</span>
                </div>
              </div>

              <!-- Order Note -->
              @if (order.note) {
                <div class="order-note">
                  <ion-icon name="alert-circle-outline"></ion-icon>
                  <span>{{ order.note }}</span>
                </div>
              }

              <!-- Items List -->
              <div class="items-list">
                @for (item of order.items; track item.id) {
                  <div class="item-row" [class.item-done]="item.status === 'DONE'" [class.item-cancelled]="item.status === 'CANCELLED'">
                    <div class="item-info">
                      <span class="item-qty">{{ item.quantity }}x</span>
                      <span class="item-name">{{ item.name }}</span>
                      @if (item.status === 'DONE') {
                        <ion-icon name="checkmark-circle" class="item-status-icon done"></ion-icon>
                      }
                      @if (item.status === 'CANCELLED') {
                        <ion-icon name="close-circle" class="item-status-icon cancelled"></ion-icon>
                      }
                    </div>
                    <div class="item-right">
                      <span class="item-price">{{ item.price * item.quantity | currency:'RON':'symbol':'1.2-2' }}</span>
                    </div>
                    @if (item.note) {
                      <div class="item-note">{{ item.note }}</div>
                    }
                    <!-- Item actions for IN_PROGRESS orders assigned to current user -->
                    @if (order.status === 'IN_PROGRESS' && order.assignedUser === currentUsername && item.status !== 'DONE' && item.status !== 'CANCELLED') {
                      <div class="item-actions">
                        <button class="item-btn done-btn" (click)="updateItemStatus(item.id, 'DONE')">
                          <ion-icon name="checkmark-outline"></ion-icon>
                          Done
                        </button>
                        <button class="item-btn cancel-btn" (click)="updateItemStatus(item.id, 'CANCELLED')">
                          <ion-icon name="close-circle"></ion-icon>
                          Cancel
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Action Buttons -->
              <div class="order-actions">
                @if (order.status === 'ACTIVE') {
                  <button class="action-btn start-btn" (click)="startOrder(order)">
                    <ion-icon name="play-outline"></ion-icon>
                    Start
                  </button>
                }
                @if (order.status === 'IN_PROGRESS' && order.assignedUser === currentUsername) {
                  <button class="action-btn return-btn" (click)="returnOrder(order)">
                    <ion-icon name="return-down-back-outline"></ion-icon>
                    Return
                  </button>
                  <button class="action-btn complete-btn" (click)="completeOrder(order)">
                    <ion-icon name="checkmark-done-outline"></ion-icon>
                    Complete
                  </button>
                }
                @if (order.status === 'READY' && order.assignedUser === currentUsername) {
                  <button class="action-btn delivered-btn" (click)="deliverOrder(order)">
                    <ion-icon name="checkmark-done-outline"></ion-icon>
                    Delivered
                  </button>
                }
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    ion-content {
      --background: #f1f5f9;
    }

    .tabs-container {
      display: flex;
      padding: 12px 12px 0;
      gap: 8px;
      background: #f1f5f9;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .tab-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 8px;
      border: 2px solid #3b82f6;
      border-radius: 10px;
      background: white;
      color: #3b82f6;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      transition: all 0.2s ease;
    }

    .tab-button.active {
      background: #3b82f6;
      color: white;
    }

    .tab-button.tab-in-progress {
      border-color: #f59e0b;
      color: #f59e0b;
    }

    .tab-button.tab-in-progress.active {
      background: #f59e0b;
      color: white;
    }

    .tab-button.tab-ready {
      border-color: #10b981;
      color: #10b981;
    }

    .tab-button.tab-ready.active {
      background: #10b981;
      color: white;
    }

    .tab-label {
      white-space: nowrap;
    }

    .orders-list {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 24px;
    }

    .order-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
    }

    .order-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .order-number {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }

    .order-point {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .order-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: right;
    }

    .order-nickname {
      font-size: 13px;
      color: #8b5cf6;
      font-weight: 600;
      background: #f5f3ff;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .order-total {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
    }

    .order-note {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 16px;
      background: #fef9c3;
      color: #854d0e;
      font-size: 13px;
    }

    .order-note ion-icon {
      flex-shrink: 0;
      margin-top: 1px;
      font-size: 16px;
    }

    .items-list {
      padding: 8px 16px;
    }

    .item-row {
      padding: 8px 0;
      border-bottom: 1px solid #f8fafc;
    }

    .item-row:last-child {
      border-bottom: none;
    }

    .item-row.item-done {
      opacity: 0.55;
    }

    .item-row.item-cancelled {
      opacity: 0.4;
      text-decoration: line-through;
    }

    .item-info {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .item-qty {
      font-weight: 700;
      color: #3b82f6;
      font-size: 14px;
      min-width: 28px;
    }

    .item-name {
      font-size: 14px;
      color: #334155;
      font-weight: 500;
      flex: 1;
    }

    .item-status-icon {
      font-size: 18px;
    }

    .item-status-icon.done {
      color: #10b981;
    }

    .item-status-icon.cancelled {
      color: #ef4444;
    }

    .item-right {
      display: flex;
      justify-content: flex-end;
      padding-top: 2px;
    }

    .item-price {
      font-size: 13px;
      color: #64748b;
    }

    .item-note {
      font-size: 12px;
      color: #94a3b8;
      font-style: italic;
      padding: 2px 0 0 34px;
    }

    .item-actions {
      display: flex;
      gap: 8px;
      padding: 6px 0 2px 28px;
    }

    .item-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 8px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      min-height: 32px;
    }

    .item-btn ion-icon {
      font-size: 14px;
    }

    .done-btn {
      background: #d1fae5;
      color: #065f46;
    }

    .cancel-btn {
      background: #fee2e2;
      color: #991b1b;
    }

    .order-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid #f1f5f9;
    }

    .action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 16px;
      border-radius: 10px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      transition: opacity 0.2s ease;
    }

    .action-btn:active {
      opacity: 0.7;
    }

    .action-btn ion-icon {
      font-size: 18px;
    }

    .start-btn {
      background: #3b82f6;
      color: white;
    }

    .return-btn {
      background: #f1f5f9;
      color: #475569;
      flex: 0.4;
    }

    .complete-btn {
      background: #f59e0b;
      color: white;
    }

    .delivered-btn {
      background: #10b981;
      color: white;
    }

    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: var(--ion-color-medium);
      text-align: center;
    }

    .placeholder ion-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .placeholder p {
      margin: 0;
      font-size: 14px;
    }
  `]
})
export class OrdersPage implements OnInit, OnDestroy {
  activeTab: TabKey = 'ordered';
  orders: Order[] = [];
  loading = true;
  currentUsername = '';
  eventId = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private authService: AuthService,
    private webSocketService: WebSocketService
  ) {
    addIcons({
      receiptOutline,
      checkmarkCircle,
      closeCircle,
      playOutline,
      checkmarkOutline,
      returnDownBackOutline,
      checkmarkDoneOutline,
      alertCircleOutline
    });
  }

  ngOnInit(): void {
    const userInfo = this.authService.getUserInfo();
    this.currentUsername = userInfo?.username || '';

    this.eventId = this.route.parent?.snapshot.paramMap.get('id') || '';

    this.loadOrders();
    this.setupWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  get orderedOrders(): Order[] {
    return this.orders.filter(o => o.status === 'ACTIVE');
  }

  get inProgressOrders(): Order[] {
    return this.orders.filter(o => o.status === 'IN_PROGRESS');
  }

  get readyOrders(): Order[] {
    return this.orders.filter(o => o.status === 'READY');
  }

  get currentOrders(): Order[] {
    switch (this.activeTab) {
      case 'ordered':
        return this.orderedOrders;
      case 'inProgress':
        return this.inProgressOrders;
      case 'ready':
        return this.readyOrders;
    }
  }

  getOrderTotal(order: Order): number {
    return order.items
      .filter(item => item.status !== 'CANCELLED')
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  onRefresh(event: any): void {
    this.loadOrders(() => {
      event.target.complete();
    });
  }

  startOrder(order: Order): void {
    this.updateOrderStatus(order.id, 'IN_PROGRESS');
  }

  returnOrder(order: Order): void {
    this.updateOrderStatus(order.id, 'ACTIVE');
  }

  completeOrder(order: Order): void {
    const headers = this.getAuthHeaders();
    this.http.patch(`${environment.apiUrl}/orders/${order.id}/complete`, null, { headers }).subscribe({
      next: () => this.loadOrders(),
      error: (err) => console.error('[OrdersPage] Error completing order:', err)
    });
  }

  deliverOrder(order: Order): void {
    this.updateOrderStatus(order.id, 'DELIVERED');
  }

  updateItemStatus(itemId: string, status: string): void {
    const headers = this.getAuthHeaders();
    this.http.patch(`${environment.apiUrl}/orders/items/${itemId}/status?status=${status}`, null, { headers }).subscribe({
      next: () => this.loadOrders(),
      error: (err) => console.error('[OrdersPage] Error updating item status:', err)
    });
  }

  private updateOrderStatus(orderId: string, status: string): void {
    const headers = this.getAuthHeaders();
    this.http.patch(
      `${environment.apiUrl}/orders/${orderId}/status?status=${status}&user=${this.currentUsername}`,
      null,
      { headers }
    ).subscribe({
      next: () => this.loadOrders(),
      error: (err) => console.error('[OrdersPage] Error updating order status:', err)
    });
  }

  private loadOrders(callback?: () => void): void {
    const headers = this.getAuthHeaders();
    this.http.get<Order[]>(`${environment.apiUrl}/orders/events/${this.eventId}`, { headers }).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
        callback?.();
      },
      error: (err) => {
        console.error('[OrdersPage] Error loading orders:', err);
        this.loading = false;
        callback?.();
      }
    });
  }

  private setupWebSocket(): void {
    const sub = this.webSocketService.subscribeToEventOrders(this.eventId).subscribe(() => {
      this.loadOrders();
    });
    this.subscriptions.push(sub);
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }
}
