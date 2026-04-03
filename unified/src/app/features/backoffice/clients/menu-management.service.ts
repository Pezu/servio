import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Menu {
  id?: string;
  name: string;
  locationId: string;
  locationName?: string;
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
export class MenuManagementService {
  private apiUrl = `${environment.apiUrl}/api/menus`;

  constructor(private http: HttpClient) {}

  getMenusByLocationId(locationId: string, page: number = 0, size: number = 20): Observable<PageResponse<Menu>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<PageResponse<Menu>>(`${this.apiUrl}/location/${locationId}`, { params });
  }

  getMenu(id: string): Observable<Menu> {
    return this.http.get<Menu>(`${this.apiUrl}/${id}`);
  }

  createMenu(locationId: string, name: string): Observable<Menu> {
    return this.http.post<Menu>(`${this.apiUrl}/location/${locationId}`, { name });
  }

  updateMenu(id: string, name: string, locationId: string): Observable<Menu> {
    return this.http.put<Menu>(`${this.apiUrl}/${id}`, { name, locationId });
  }

  deleteMenu(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getMenuItems(menuId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${menuId}/items`);
  }

  saveMenuItems(menuId: string, items: any[]): Observable<any[]> {
    return this.http.put<any[]>(`${this.apiUrl}/${menuId}/items`, items);
  }
}
