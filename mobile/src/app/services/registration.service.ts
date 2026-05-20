import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Registration {
  id: string;
  event: {
    id: string;
    name: string;
  };
  orderPointId: string;
  orderPointName: string;
  orderPointPayLater: boolean;
  validationStatus: 'PENDING' | 'APPROVED';
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  nickname: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegistrationService {
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

  getPendingRegistrations(eventId: string): Observable<Registration[]> {
    return this.http.get<Registration[]>(
      `${environment.apiUrl}/register/events/${eventId}/pending`,
      { headers: this.getHeaders() }
    );
  }

  getMyWaiterRegistration(eventId: string): Observable<Registration> {
    return this.http.get<Registration>(
      `${environment.apiUrl}/register/events/${eventId}/my-waiter`,
      { headers: this.getHeaders() }
    );
  }

  approveRegistration(registrationId: string): Observable<Registration> {
    return this.http.post<Registration>(
      `${environment.apiUrl}/register/${registrationId}/approve`,
      {},
      { headers: this.getHeaders() }
    );
  }
}