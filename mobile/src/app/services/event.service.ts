import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  locationId: string;
  locationName?: string;
  clientName?: string;
  logoPath?: string;
  status?: string;
}

interface PageResponse<T> {
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
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private hasRoleSuper(): boolean {
    const userInfo = this.authService.getUserInfo();
    return userInfo?.roles?.includes('SUPER') || false;
  }

  getMyActiveEvents(): Observable<Event[]> {
    const params = new HttpParams().set('page', '0').set('size', '100');

    // SUPER users see all active events, others see only their assigned events
    const endpoint = this.hasRoleSuper()
      ? `${environment.apiUrl}/events/active`
      : `${environment.apiUrl}/events/my-events/active`;

    return this.http.get<PageResponse<Event>>(endpoint, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => response.content)
    );
  }

  getAllActiveEvents(): Observable<Event[]> {
    const params = new HttpParams().set('page', '0').set('size', '100');
    return this.http.get<PageResponse<Event>>(`${environment.apiUrl}/events/active`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => response.content)
    );
  }
}