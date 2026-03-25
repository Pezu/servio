import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface Allergen {
  id?: string;
  number?: number;
  name: string;
  active?: boolean;
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
export class AllergenService {
  private apiUrl = `${environment.apiUrl}/api/allergens`;

  constructor(private http: HttpClient) {}

  getAllergens(page: number = 0, size: number = 10): Observable<PageResponse<Allergen>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Allergen>>(this.apiUrl, { params });
  }

  getAllergen(id: string): Observable<Allergen> {
    return this.http.get<Allergen>(`${this.apiUrl}/${id}`);
  }

  createAllergen(allergen: Allergen): Observable<Allergen> {
    return this.http.post<Allergen>(this.apiUrl, allergen);
  }

  updateAllergen(id: string, allergen: Allergen): Observable<Allergen> {
    return this.http.put<Allergen>(`${this.apiUrl}/${id}`, allergen);
  }

  toggleActive(id: string): Observable<Allergen> {
    return this.http.post<Allergen>(`${this.apiUrl}/${id}/toggle-active`, {});
  }
}
