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
  allergenIds?: string[];
  vatTypeId?: string;
}

export interface Allergen {
  id: string;
  number: number;
  name: string;
  active: boolean;
}

export interface VatType {
  id: string;
  name: string;
  value: number;
  active: boolean;
}

export interface Menu {
  id?: string;
  locationId: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = `${environment.apiUrl}/api/menu`;

  constructor(private http: HttpClient) {}

  // ==================== Menu CRUD Operations ====================

  getMenusByLocation(locationId: string): Observable<Menu[]> {
    return this.http.get<Menu[]>(`${this.apiUrl}/menus/location/${locationId}`);
  }

  createMenu(locationId: string, name: string): Observable<Menu> {
    return this.http.post<Menu>(`${this.apiUrl}/menus`, { locationId, name });
  }

  deleteMenu(menuId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/menus/${menuId}`);
  }

  // ==================== Menu Tree Operations (by Menu ID) ====================

  getMenuTreeByMenuId(menuId: string): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.apiUrl}/menus/${menuId}/tree`);
  }

  saveMenuTreeByMenuId(menuId: string, menuItems: MenuItem[]): Observable<MenuItem[]> {
    return this.http.put<MenuItem[]>(`${this.apiUrl}/menus/${menuId}/tree`, menuItems);
  }

  // ==================== Legacy Location-based Operations ====================

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

  getActiveAllergens(): Observable<Allergen[]> {
    return this.http.get<Allergen[]>(`${environment.apiUrl}/api/allergens/active`);
  }

  getActiveVatTypes(): Observable<VatType[]> {
    return this.http.get<VatType[]>(`${environment.apiUrl}/api/vat-types/active`);
  }
}