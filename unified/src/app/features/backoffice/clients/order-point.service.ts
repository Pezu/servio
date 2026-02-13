import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface OrderPoint {
  id?: string;
  name: string;
  locationId: string;
  payLater: boolean;
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
export class OrderPointService {
  private apiUrl = `${environment.apiUrl}/api/order-points`;

  constructor(private http: HttpClient) {}

  getOrderPointsByLocationId(locationId: string, page: number = 0, size: number = 20): Observable<PageResponse<OrderPoint>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<OrderPoint>>(`${this.apiUrl}/location/${locationId}`, { params });
  }

  getOrderPoint(id: string): Observable<OrderPoint> {
    return this.http.get<OrderPoint>(`${this.apiUrl}/${id}`);
  }

  createOrderPoint(locationId: string, name: string, payLater: boolean = false): Observable<OrderPoint> {
    return this.http.post<OrderPoint>(`${this.apiUrl}/location/${locationId}`, { name, payLater });
  }

  updateOrderPoint(id: string, name: string, locationId: string, payLater: boolean = false): Observable<OrderPoint> {
    return this.http.put<OrderPoint>(`${this.apiUrl}/${id}`, { name, locationId, payLater });
  }
}