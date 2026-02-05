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
}

export interface Order {
  id: string;
  orderNo: number;
  createdAt: string;
  registrationId: string;
  eventId: string;
  eventName?: string;
  orderPointId: string;
  status: string;
  assignedUser?: string;
  note?: string;
  items: OrderItem[];
  totalAmount: number;
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

  getOrders(page: number = 0, size: number = 20, startDate?: string, endDate?: string): Observable<PageResponse<Order>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    return this.http.get<PageResponse<Order>>(this.apiUrl, { params });
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }
}