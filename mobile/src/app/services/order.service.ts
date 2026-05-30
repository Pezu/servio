import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: 'ORDERED' | 'CANCELLED';
  note?: string;
  paid?: boolean;
  vatRate?: number;
}

export interface Order {
  id: string;
  orderNo: number;
  registrationId: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  groupId: string;
  status: string;
  assignedUser: string | null;
  note?: string;
  needsPayment: boolean;
  nickname?: string;
  items: OrderItem[];
  paymentMethod?: string;
  paidAt?: string | null;
  /** Fiscal-receipt lifecycle, independent of payment.
   *  null = no receipt attempted (PROTOCOL, or no ECR device). */
  fiscalReceiptStatus?: 'PENDING' | 'ISSUED' | 'FAILED' | null;
  fiscalReceiptId?: string | null;
  /** Reason shown when fiscalReceiptStatus === 'FAILED'. */
  fiscalError?: string | null;
  fiscalAttemptedAt?: string | null;
}

export interface EventOrderPoint {
  id?: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  sublocationName?: string;
  userIds?: string[];
  userNames?: string[];
  userLogins?: string[];
  cashRegisterId?: string | null;
  cashRegisterName?: string;
  payLater?: boolean;
  protocol?: boolean;
  prepaid?: number;
  credit?: boolean;
  creditValue?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  orderable: boolean;
  description?: string;
  imagePath?: string;
  children?: MenuItem[];
  allergenIds?: string[];
  vatTypeId?: string;
}

export interface OrderPoint {
  id: string;
  name: string;
  menuId?: string;
}

export interface CreateOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateOrderRequest {
  registrationId?: string;
  orderPointId: string;
  note?: string;
  payLater: boolean;
  nickname?: string;
  orderItems: CreateOrderItem[];
}

export interface ProtocolPaymentSummary {
  orderId: string;
  orderNo: number;
  paidAt: string | null;
  paidBy: string | null;
  totalAmount: number;
  orderPointId: string | null;
  orderPointName: string | null;
  clientName: string | null;
}

export interface CashRegisterReceiptResponse {
  status: string;            // "OK" | "ERROR" | "PENDING"
  receiptNumber?: string;
  fiscalReceiptId?: string;
  cashRegisterSerial?: string;
  issuedAt?: string;
  totalAmount?: number;
  paymentMethod?: string;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  private headers(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getEventOrderPoints(eventId: string): Observable<EventOrderPoint[]> {
    return this.http.get<EventOrderPoint[]>(
      `${environment.apiUrl}/events/${eventId}/order-points`,
      { headers: this.headers() }
    );
  }

  splitEventOrderPoint(eventId: string, orderPointId: string): Observable<EventOrderPoint> {
    return this.http.post<EventOrderPoint>(
      `${environment.apiUrl}/events/${eventId}/order-points/${orderPointId}/split`,
      {},
      { headers: this.headers() }
    );
  }

  getOrders(eventId: string): Observable<Order[]> {
    return this.http.get<Order[]>(
      `${environment.apiUrl}/orders/events/${eventId}`,
      { headers: this.headers() }
    );
  }

  getOrdersNeedingPayment(eventId: string): Observable<Order[]> {
    return this.http.get<Order[]>(
      `${environment.apiUrl}/orders/events/${eventId}/needs-payment`,
      { headers: this.headers() }
    );
  }

  /** Closed (delivered/completed) orders for the event — Orders → Closed tab. */
  getClosedOrders(eventId: string): Observable<Order[]> {
    return this.http.get<Order[]>(
      `${environment.apiUrl}/orders/events/${eventId}/closed`,
      { headers: this.headers() }
    );
  }

  takeOrder(orderId: string, user: string): Observable<Order> {
    return this.http.patch<Order>(
      `${environment.apiUrl}/orders/${orderId}/status?status=IN_PROGRESS&user=${encodeURIComponent(user)}`,
      {},
      { headers: this.headers() }
    );
  }

  setOrderStatus(orderId: string, status: string): Observable<Order> {
    return this.http.patch<Order>(
      `${environment.apiUrl}/orders/${orderId}/status?status=${status}`,
      {},
      { headers: this.headers() }
    );
  }

  bulkMarkPaid(payload: {
    orderIds: string[];
    paymentMethod: 'CASH' | 'CARD' | 'PROTOCOL';
    paidBy: string;
    cashRegisterDeviceId: string | null;
    tip?: number;
  }): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/orders/bulk-paid`,
      payload,
      { headers: this.headers() }
    );
  }

  partialMarkPaid(payload: {
    items: { orderItemId: string; quantity: number }[];
    paymentMethod: 'CASH' | 'CARD' | 'PROTOCOL';
    paidBy: string;
    cashRegisterDeviceId: string | null;
    tip?: number;
  }): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/orders/partial-paid`,
      payload,
      { headers: this.headers() }
    );
  }

  /** Re-print a FAILED fiscal receipt. Does NOT re-charge — the order stays paid. */
  retryReceipt(payload: {
    orderIds: string[];
    cashRegisterDeviceId?: string | null;
  }): Observable<CashRegisterReceiptResponse> {
    return this.http.post<CashRegisterReceiptResponse>(
      `${environment.apiUrl}/orders/cash-register/retry`,
      payload,
      { headers: this.headers() }
    );
  }

  getProtocolPayments(eventId: string): Observable<ProtocolPaymentSummary[]> {
    return this.http.get<ProtocolPaymentSummary[]>(
      `${environment.apiUrl}/orders/events/${eventId}/protocol-payments`,
      { headers: this.headers() }
    );
  }

  getOrderPoint(orderPointId: string): Observable<OrderPoint> {
    return this.http.get<OrderPoint>(
      `${environment.apiUrl}/order-points/${orderPointId}`,
      { headers: this.headers() }
    );
  }

  getMenuItems(menuId: string): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(
      `${environment.apiUrl}/menu/menus/${menuId}/tree`,
      { headers: this.headers() }
    );
  }

  createOrder(request: CreateOrderRequest): Observable<Order> {
    return this.http.post<Order>(
      `${environment.apiUrl}/orders`,
      request,
      { headers: this.headers() }
    );
  }
}
