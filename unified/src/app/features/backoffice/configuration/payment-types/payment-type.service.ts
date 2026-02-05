import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface PaymentType {
  id?: string;
  name: string;
  description?: string;
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
export class PaymentTypeService {
  private apiUrl = `${environment.apiUrl}/api/payment-types`;

  constructor(private http: HttpClient) {}

  getPaymentTypes(page: number = 0, size: number = 10): Observable<PageResponse<PaymentType>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<PaymentType>>(this.apiUrl, { params });
  }

  getPaymentType(id: string): Observable<PaymentType> {
    return this.http.get<PaymentType>(`${this.apiUrl}/${id}`);
  }

  createPaymentType(paymentType: PaymentType): Observable<PaymentType> {
    return this.http.post<PaymentType>(this.apiUrl, paymentType);
  }

  updatePaymentType(id: string, paymentType: PaymentType): Observable<PaymentType> {
    return this.http.put<PaymentType>(`${this.apiUrl}/${id}`, paymentType);
  }

  deletePaymentType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}