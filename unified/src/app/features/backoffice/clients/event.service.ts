import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Event {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  locationId: string;
  logoPath?: string;
  userIds?: string[];
  paymentTypeIds?: string[];
  menuItemIds?: string[];
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
export class EventService {
  private apiUrl = `${environment.apiUrl}/api/events`;

  constructor(private http: HttpClient) {}

  getEventsByLocationId(locationId: string, page: number = 0, size: number = 20): Observable<PageResponse<Event>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Event>>(`${this.apiUrl}/location/${locationId}`, { params });
  }

  getEvent(id: string): Observable<Event> {
    return this.http.get<Event>(`${this.apiUrl}/${id}`);
  }

  createEvent(locationId: string, event: { name: string; startDate: string; endDate: string; userIds?: string[]; paymentTypeIds?: string[]; menuItemIds?: string[] }): Observable<Event> {
    return this.http.post<Event>(`${this.apiUrl}/location/${locationId}`, event);
  }

  updateEvent(id: string, event: { name: string; startDate: string; endDate: string; locationId: string; userIds?: string[]; paymentTypeIds?: string[]; menuItemIds?: string[] }): Observable<Event> {
    return this.http.put<Event>(`${this.apiUrl}/${id}`, event);
  }

  downloadQrPdf(eventId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${eventId}/qr`, { responseType: 'blob' });
  }

  uploadLogo(id: string, file: File): Observable<Event> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Event>(`${this.apiUrl}/${id}/logo`, formData);
  }

  deleteLogo(id: string): Observable<Event> {
    return this.http.delete<Event>(`${this.apiUrl}/${id}/logo`);
  }

  getLogoUrl(logoPath: string): string {
    return `${environment.apiUrl}/api/images/${logoPath}`;
  }
}