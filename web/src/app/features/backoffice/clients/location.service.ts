import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Location {
  id?: string;
  name: string;
  clientId: string;
  parentId?: string;
  parentName?: string;
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
export class LocationService {
  private apiUrl = `${environment.apiUrl}/api/locations`;

  constructor(private http: HttpClient) {}

  getLocationsByClientId(clientId: string, page: number = 0, size: number = 20): Observable<PageResponse<Location>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Location>>(`${this.apiUrl}/client/${clientId}`, { params });
  }

  getSubLocations(parentId: string, page: number = 0, size: number = 20): Observable<PageResponse<Location>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Location>>(`${this.apiUrl}/${parentId}/sublocations`, { params });
  }

  getLocation(id: string): Observable<Location> {
    return this.http.get<Location>(`${this.apiUrl}/${id}`);
  }

  createLocation(clientId: string, name: string, parentId?: string): Observable<Location> {
    return this.http.post<Location>(`${this.apiUrl}/client/${clientId}`, { name, parentId });
  }

  updateLocation(id: string, name: string, clientId: string, parentId?: string): Observable<Location> {
    return this.http.put<Location>(`${this.apiUrl}/${id}`, { name, clientId, parentId });
  }
}