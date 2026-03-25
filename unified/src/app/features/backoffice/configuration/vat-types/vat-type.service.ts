import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface VatType {
  id?: string;
  name: string;
  value: number;
  active?: boolean;
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
export class VatTypeService {
  private apiUrl = `${environment.apiUrl}/api/vat-types`;

  constructor(private http: HttpClient) {}

  getVatTypes(page: number = 0, size: number = 10): Observable<PageResponse<VatType>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<VatType>>(this.apiUrl, { params });
  }

  getVatType(id: string): Observable<VatType> {
    return this.http.get<VatType>(`${this.apiUrl}/${id}`);
  }

  createVatType(vatType: VatType): Observable<VatType> {
    return this.http.post<VatType>(this.apiUrl, vatType);
  }

  updateVatType(id: string, vatType: VatType): Observable<VatType> {
    return this.http.put<VatType>(`${this.apiUrl}/${id}`, vatType);
  }

  toggleActive(id: string): Observable<VatType> {
    return this.http.post<VatType>(`${this.apiUrl}/${id}/toggle-active`, {});
  }
}