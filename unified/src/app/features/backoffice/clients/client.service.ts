import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Client {
  id?: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  logoPath?: string;
  clientTypeId?: string;
  clientTypeName?: string;
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
export class ClientService {
  private apiUrl = `${environment.apiUrl}/api/clients`;

  constructor(private http: HttpClient) {}

  getClients(page: number = 0, size: number = 10, search?: string): Observable<PageResponse<Client>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PageResponse<Client>>(this.apiUrl, { params });
  }

  getClient(id: string): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`);
  }

  createClient(client: Client): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, client);
  }

  updateClient(id: string, client: Client): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, client);
  }

  uploadLogo(id: string, file: File): Observable<Client> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Client>(`${this.apiUrl}/${id}/logo`, formData);
  }

  deleteLogo(id: string): Observable<Client> {
    return this.http.delete<Client>(`${this.apiUrl}/${id}/logo`);
  }

  getLogoUrl(logoPath: string): string {
    return `${environment.apiUrl}/api/images/${logoPath}`;
  }
}