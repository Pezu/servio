import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface MenuItem {
  id?: string;
  tempId?: string;
  name: string;
  orderable: boolean;
  price?: number;
  imagePath?: string;
  description?: string;
  children: MenuItem[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = `${environment.apiUrl}/api/menu`;

  constructor(private http: HttpClient) {}

  getMenuTree(locationId: string): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.apiUrl}/location/${locationId}`);
  }

  saveMenuTree(locationId: string, menuItems: MenuItem[]): Observable<MenuItem[]> {
    return this.http.put<MenuItem[]>(`${this.apiUrl}/location/${locationId}`, menuItems);
  }

  uploadImage(menuItemId: string, file: File): Observable<MenuItem> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MenuItem>(`${this.apiUrl}/item/${menuItemId}/image`, formData);
  }

  deleteImage(menuItemId: string): Observable<MenuItem> {
    return this.http.delete<MenuItem>(`${this.apiUrl}/item/${menuItemId}/image`);
  }

  getImageUrl(imagePath: string): string {
    return `${environment.apiUrl}/api/images/${imagePath}`;
  }

  // Client-level menu methods
  getClientMenuTree(clientId: string): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.apiUrl}/client/${clientId}`);
  }

  saveClientMenuTree(clientId: string, menuItems: MenuItem[]): Observable<MenuItem[]> {
    return this.http.put<MenuItem[]>(`${this.apiUrl}/client/${clientId}`, menuItems);
  }
}