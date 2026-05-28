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

  markOrderPaid(orderId: string, paymentMethod: string, paidBy: string): Observable<Order> {
    return this.http.patch<Order>(
      `${environment.apiUrl}/orders/${orderId}/paid`,
      { paymentMethod, paidBy },
      { headers: this.headers() }
    );
  }

  getCashRegisters(eventId: string): Observable<{ id: string; name: string }[]> {
    return this.http.get<{ id: string; name: string }[]>(
      `${environment.apiUrl}/events/${eventId}/cash-registers`,
      { headers: this.headers() }
    );
  }

  printCashRegisterReceipt(payload: {
    orderIds: string[];
    paymentMethod: 'CASH' | 'CARD';
    operator: string;
    cashRegisterDeviceId: string | null;
  }): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/orders/cash-register/receipt`,
      payload,
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
