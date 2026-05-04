import { Component, OnInit } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  locationId: string;
  logoPath?: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Component({
  selector: 'app-my-events',
  standalone: true,
  imports: [TranslateModule],
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .section {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      margin-bottom: 0;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-shrink: 0;
    }
    .section-header h2 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }
    .active-badge {
      background: #dcfce7;
      color: #166534;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .table-container {
      background: white;
      border-radius: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 0.875rem 1rem;
      background: white;
      color: #64748b;
      font-weight: 500;
      font-size: 0.875rem;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    td {
      padding: 0.875rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover td {
      background: #f8fafc;
    }
    .event-name-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .event-logo-small {
      width: 40px;
      height: 40px;
      border-radius: 0;
      object-fit: cover;
      background: #f1f5f9;
    }
    .event-logo-placeholder-small {
      width: 40px;
      height: 40px;
      border-radius: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .event-logo-placeholder-small svg {
      width: 20px;
      height: 20px;
      color: white;
      opacity: 0.8;
    }
    .status-active {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: #dcfce7;
      color: #166534;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .status-active::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
    }
    .arrow-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: transparent;
      color: #64748b;
      border: 1px solid #e2e8f0;
      border-radius: 50%;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .arrow-btn:hover {
      border-color: #3b82f6;
      color: #3b82f6;
    }
    .arrow-btn svg {
      width: 18px;
      height: 18px;
    }
    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: #64748b;
      background: white;
      border-radius: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .empty-state svg {
      width: 48px;
      height: 48px;
      margin-bottom: 0.75rem;
      opacity: 0.5;
    }
    .empty-state h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 0.25rem;
    }
    .empty-state p {
      margin: 0;
      font-size: 0.875rem;
    }
    .loading {
      text-align: center;
      padding: 2rem;
      color: #64748b;
    }
  `],
  template: `
    <!-- Active Events Section -->
    <div class="section">
      <div class="section-header">
        <h2>{{ 'MY_EVENTS.ACTIVE_EVENTS' | translate }}</h2>
        <span class="active-badge">{{ 'MY_EVENTS.CURRENTLY_RUNNING' | translate }}</span>
      </div>
    
      @if (loading) {
        <div class="loading">
          {{ 'MY_EVENTS.LOADING_ACTIVE' | translate }}
        </div>
      }
    
      @if (!loading && activeEvents.length === 0) {
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3>{{ 'MY_EVENTS.NO_ACTIVE_EVENTS' | translate }}</h3>
          <p>{{ 'MY_EVENTS.NO_ACTIVE_EVENTS_DESC' | translate }}</p>
        </div>
      }
    
      @if (!loading && activeEvents.length > 0) {
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ 'EVENTS.EVENT_NAME' | translate }}</th>
                <th>{{ 'EVENTS.START_DATE' | translate }}</th>
                <th>{{ 'EVENTS.END_DATE' | translate }}</th>
                <th>{{ 'COMMON.STATUS' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (event of activeEvents; track event) {
                <tr>
                  <td>
                    <div class="event-name-cell">
                      @if (event.logoPath) {
                        <img [src]="getLogoUrl(event.logoPath)" class="event-logo-small" [alt]="event.name">
                      }
                      @if (!event.logoPath) {
                        <div class="event-logo-placeholder-small">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      }
                      <span>{{ event.name }}</span>
                    </div>
                  </td>
                  <td>{{ formatDate(event.startDate) }}</td>
                  <td>{{ formatDate(event.endDate) }}</td>
                  <td><span class="status-active">{{ 'MY_EVENTS.STATUS_ACTIVE' | translate }}</span></td>
                  <td>
                    <a [href]="'/event/' + event.id + '/orders'" target="_blank" class="arrow-btn">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
    `
})
export class MyEventsComponent implements OnInit {
  activeEvents: Event[] = [];
  loading = true;
  hasRoleSuper = false;

  private apiUrl = `${environment.apiUrl}/api/events`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.hasRoleSuper = this.checkHasRole('SUPER');
    this.loadActiveEvents();
  }

  private checkHasRole(role: string): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      const roles: string[] = decoded.roles || [];
      return roles.includes(role);
    } catch {
      return false;
    }
  }

  loadActiveEvents(): void {
    this.loading = true;
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '100');

    // SUPER users see all active events, others see only their assigned events
    const endpoint = this.hasRoleSuper
      ? `${this.apiUrl}/active`
      : `${this.apiUrl}/my-events/active`;

    this.http.get<PageResponse<Event>>(endpoint, { params })
      .subscribe({
        next: (response) => {
          this.activeEvents = response.content;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading active events:', err);
          this.activeEvents = [];
          this.loading = false;
        }
      });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getLogoUrl(logoPath: string): string {
    return `${environment.apiUrl}/api/images/${logoPath}`;
  }
}