import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
  note?: string;
  paid?: boolean;
}

export interface OrderPayment {
  amount: number;
  paymentMethod?: string;
  paidBy?: string;
  paidAt?: string;
  fiscalReceiptId?: string | null;
  receiptNumber?: string | null;
}

export interface Order {
  id: string;
  orderNo: number;
  createdAt: string;
  registrationId: string;
  eventId: string;
  eventName?: string;
  orderPointId: string;
  orderPointName?: string;
  status: string;
  assignedUser?: string;
  note?: string;
  needsPayment?: boolean;
  paymentMethod?: string;
  paidBy?: string;
  paidAt?: string;
  tip?: number;
  /** Distinct payment transactions that settled this order (> 1 = partial pay). */
  paymentCount?: number;
  /** Per-payment breakdown (amount + method) — drives the revenue report detail. */
  payments?: OrderPayment[];
  /** Order-level fiscal receipt (fallback for card/synthetic payments). */
  fiscalReceiptId?: string | null;
  receiptNumber?: string | null;
  items: OrderItem[];
  totalAmount: number;
  netAmount?: number;
  vatAmount?: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/api/orders`;

  constructor(private http: HttpClient) {}

  getOrders(page: number = 0, size: number = 20, startDate?: string, endDate?: string, eventId?: string): Observable<PageResponse<Order>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    if (eventId) {
      params = params.set('eventId', eventId);
    }
    return this.http.get<PageResponse<Order>>(this.apiUrl, { params });
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }
}