import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface EventOrderPoint {
  id?: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  sublocationName: string;
  userIds?: string[];
  userNames?: string[];
  userLogins?: string[];
  cashRegisterId?: string | null;
  cashRegisterName?: string;
  payLater?: boolean;
  prepaid: number;
  clientName?: string;
  email?: string;
  phone?: string;
  credit: boolean;
  creditValue?: number;
  protocol?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EventOrderPointService {
  private apiUrl = `${environment.apiUrl}/api/events`;

  constructor(private http: HttpClient) {}

  getEventOrderPoints(eventId: string): Observable<EventOrderPoint[]> {
    return this.http.get<EventOrderPoint[]>(`${this.apiUrl}/${eventId}/order-points`);
  }

  saveEventOrderPoint(eventId: string, orderPointId: string, data: EventOrderPoint): Observable<EventOrderPoint> {
    return this.http.put<EventOrderPoint>(`${this.apiUrl}/${eventId}/order-points/${orderPointId}`, data);
  }
}
