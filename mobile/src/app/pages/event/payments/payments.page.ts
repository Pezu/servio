import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  checkmarkCircleOutline,
  locationOutline,
  receiptOutline
} from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
  note?: string;
  paid?: boolean;
}

interface Order {
  id: string;
  orderNo: number;
  orderPointId: string;
  orderPointName: string;
  status: string;
  nickname?: string;
  needsPayment: boolean;
  items: OrderItem[];
}

interface EventOrderPoint {
  id?: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  sublocationName: string;
  prepaid: number;
  clientName?: string;
  credit: boolean;
  creditValue?: number;
}

interface OrderGroup {
  orderPointName: string;
  orderPointId: string;
  orders: Order[];
  creditValue?: number;
  hasCredit: boolean;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonButton,
    IonSpinner
  ],
  template: `
    <ion-content class="payments-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading payments...</p>
        </div>
      } @else if (orderGroups.length === 0) {
        <div class="placeholder">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          <h2>All Paid</h2>
          <p>No orders need payment right now.</p>
        </div>
      } @else {
        <div class="orders-list">
          @for (group of orderGroups; track group.orderPointId) {
            <div class="group-section">
              <div class="group-header">
                <ion-icon name="location-outline"></ion-icon>
                <span>{{ group.orderPointName }}</span>
                @if (group.hasCredit) {
                  <span class="credit-badge">Credit: {{ group.creditValue | number:'1.2-2' }} RON</span>
                }
              </div>

              @for (order of group.orders; track order.id) {
                <div class="order-card">
                  <div class="order-header">
                    <div class="order-info">
                      <span class="order-number">#{{ order.orderNo }}</span>
                      @if (order.nickname) {
                        <span class="order-nickname">{{ order.nickname }}</span>
                      }
                    </div>
                    <span class="order-total">{{ getOrderTotal(order) | number:'1.2-2' }} RON</span>
                  </div>

                  <div class="items-list">
                    @for (item of order.items; track item.id) {
                      <div class="item-row">
                        <span class="item-qty">{{ item.quantity }} &times;</span>
                        <span class="item-name">{{ item.name }}</span>
                        <span class="item-price">{{ item.price * item.quantity | number:'1.2-2' }}</span>
                      </div>
                    }
                  </div>

                  <div class="order-actions">
                    <ion-button
                      expand="block"
                      color="success"
                      [disabled]="markingPaid[order.id]"
                      (click)="markAsPaid(order)">
                      @if (markingPaid[order.id]) {
                        <ion-spinner name="crescent" class="btn-spinner"></ion-spinner>
                      } @else {
                        <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
                        Mark Paid
                      }
                    </ion-button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Spacer so content doesn't hide behind sticky footer -->
        <div class="footer-spacer"></div>
      }
    </ion-content>

    @if (!loading && orderGroups.length > 0) {
      <div class="sticky-footer">
        <div class="footer-row">
          <span class="footer-label">Total</span>
          <span class="footer-value">{{ totalAmount | number:'1.2-2' }} RON</span>
        </div>
        @if (totalCredit > 0) {
          <div class="footer-row credit-row">
            <span class="footer-label">Credit</span>
            <span class="footer-value">{{ totalCredit | number:'1.2-2' }} RON</span>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .payments-content {
      --background: #f8fafc;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60%;
      color: var(--ion-color-medium);
    }

    .loading-container ion-spinner {
      width: 40px;
      height: 40px;
      margin-bottom: 12px;
    }

    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60%;
      color: var(--ion-color-medium);
      text-align: center;
      padding: 24px;
    }

    .placeholder ion-icon {
      font-size: 64px;
      margin-bottom: 16px;
      color: var(--ion-color-success);
    }

    .placeholder h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: var(--ion-color-dark);
    }

    .placeholder p {
      margin: 0;
      font-size: 14px;
    }

    .orders-list {
      padding: 12px;
    }

    .group-section {
      margin-bottom: 16px;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--ion-color-primary);
      color: white;
      border-radius: 10px 10px 0 0;
      font-weight: 600;
      font-size: 15px;
    }

    .group-header ion-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .credit-badge {
      margin-left: auto;
      font-size: 12px;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .order-card {
      background: white;
      border-left: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      padding: 14px;
    }

    .order-card:last-child {
      border-radius: 0 0 10px 10px;
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .order-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .order-number {
      font-weight: 700;
      font-size: 16px;
      color: var(--ion-color-primary);
    }

    .order-nickname {
      font-size: 14px;
      color: var(--ion-color-medium-shade);
      font-weight: 500;
    }

    .order-total {
      font-weight: 700;
      font-size: 15px;
      color: var(--ion-color-dark);
    }

    .items-list {
      margin-bottom: 12px;
    }

    .item-row {
      display: flex;
      align-items: center;
      padding: 4px 0;
      font-size: 14px;
      color: #475569;
    }

    .item-qty {
      min-width: 36px;
      font-weight: 600;
      color: var(--ion-color-medium-shade);
    }

    .item-name {
      flex: 1;
    }

    .item-price {
      font-weight: 500;
      color: var(--ion-color-dark);
    }

    .order-actions {
      margin-top: 4px;
    }

    .order-actions ion-button {
      --border-radius: 8px;
      font-weight: 600;
      height: 40px;
    }

    .btn-spinner {
      width: 20px;
      height: 20px;
      color: white;
    }

    .footer-spacer {
      height: 80px;
    }

    .sticky-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: white;
      padding: 12px 20px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      z-index: 100;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.15);
    }

    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .footer-label {
      font-size: 15px;
      font-weight: 600;
    }

    .footer-value {
      font-size: 18px;
      font-weight: 700;
    }

    .credit-row {
      opacity: 0.8;
    }

    .credit-row .footer-value {
      font-size: 16px;
      color: #86efac;
    }
  `]
})
export class PaymentsPage implements OnInit {
  eventId: string = '';
  orders: Order[] = [];
  orderPoints: EventOrderPoint[] = [];
  orderGroups: OrderGroup[] = [];
  loading: boolean = true;
  markingPaid: { [orderId: string]: boolean } = {};
  totalAmount: number = 0;
  totalCredit: number = 0;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    addIcons({
      cardOutline,
      checkmarkCircleOutline,
      locationOutline,
      receiptOutline
    });
  }

  ngOnInit(): void {
    this.eventId = this.route.parent?.snapshot.paramMap.get('id') || '';
    this.loadData();
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadData(): void {
    this.loading = true;

    forkJoin({
      orders: this.http.get<Order[]>(
        `${environment.apiUrl}/orders/events/${this.eventId}/needs-payment`,
        { headers: this.getHeaders() }
      ),
      orderPoints: this.http.get<EventOrderPoint[]>(
        `${environment.apiUrl}/events/${this.eventId}/order-points`,
        { headers: this.getHeaders() }
      )
    }).subscribe({
      next: ({ orders, orderPoints }) => {
        this.orders = orders;
        this.orderPoints = orderPoints;
        this.buildGroups();
        this.loading = false;
      },
      error: (err) => {
        console.error('[PaymentsPage] Error loading data:', err);
        this.loading = false;
      }
    });
  }

  private buildGroups(): void {
    const groupMap = new Map<string, OrderGroup>();

    for (const order of this.orders) {
      if (!groupMap.has(order.orderPointId)) {
        const point = this.orderPoints.find(
          p => p.orderPointId === order.orderPointId
        );
        groupMap.set(order.orderPointId, {
          orderPointName: order.orderPointName,
          orderPointId: order.orderPointId,
          orders: [],
          hasCredit: point?.credit || false,
          creditValue: point?.creditValue
        });
      }
      groupMap.get(order.orderPointId)!.orders.push(order);
    }

    this.orderGroups = Array.from(groupMap.values());
    this.calculateTotals();
  }

  private calculateTotals(): void {
    this.totalAmount = this.orders.reduce(
      (sum, order) => sum + this.getOrderTotal(order),
      0
    );

    this.totalCredit = this.orderGroups.reduce((sum, group) => {
      if (group.hasCredit && group.creditValue) {
        return sum + group.creditValue;
      }
      return sum;
    }, 0);
  }

  getOrderTotal(order: Order): number {
    return order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }

  markAsPaid(order: Order): void {
    this.markingPaid[order.id] = true;

    this.http.patch(
      `${environment.apiUrl}/orders/${order.id}/status?status=DELIVERED`,
      null,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        // Remove the order from the list
        this.orders = this.orders.filter(o => o.id !== order.id);
        this.buildGroups();
        delete this.markingPaid[order.id];
      },
      error: (err) => {
        console.error('[PaymentsPage] Error marking order as paid:', err);
        this.markingPaid[order.id] = false;
      }
    });
  }

  onRefresh(event: any): void {
    forkJoin({
      orders: this.http.get<Order[]>(
        `${environment.apiUrl}/orders/events/${this.eventId}/needs-payment`,
        { headers: this.getHeaders() }
      ),
      orderPoints: this.http.get<EventOrderPoint[]>(
        `${environment.apiUrl}/events/${this.eventId}/order-points`,
        { headers: this.getHeaders() }
      )
    }).subscribe({
      next: ({ orders, orderPoints }) => {
        this.orders = orders;
        this.orderPoints = orderPoints;
        this.buildGroups();
        event.target.complete();
      },
      error: (err) => {
        console.error('[PaymentsPage] Error refreshing data:', err);
        event.target.complete();
      }
    });
  }
}
