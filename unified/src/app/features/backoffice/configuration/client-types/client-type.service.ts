import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface ClientType {
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
export class ClientTypeService {
  private apiUrl = `${environment.apiUrl}/api/client-types`;

  constructor(private http: HttpClient) {}

  getClientTypes(page: number = 0, size: number = 10): Observable<PageResponse<ClientType>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<ClientType>>(this.apiUrl, { params });
  }

  getAllClientTypes(): Observable<ClientType[]> {
    return this.http.get<ClientType[]>(`${this.apiUrl}/all`);
  }

  getClientType(id: string): Observable<ClientType> {
    return this.http.get<ClientType>(`${this.apiUrl}/${id}`);
  }

  createClientType(clientType: ClientType): Observable<ClientType> {
    return this.http.post<ClientType>(this.apiUrl, clientType);
  }

  updateClientType(id: string, clientType: ClientType): Observable<ClientType> {
    return this.http.put<ClientType>(`${this.apiUrl}/${id}`, clientType);
  }

  deleteClientType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}