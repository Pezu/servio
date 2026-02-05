import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, RouterLink, TranslateModule],
  styles: [`
    .section {
      margin-bottom: 2rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
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
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 0.875rem 1rem;
      background: #f8fafc;
      color: #64748b;
      font-weight: 500;
      font-size: 0.875rem;
      border-bottom: 1px solid #e2e8f0;
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
      border-radius: 8px;
      object-fit: cover;
      background: #f1f5f9;
    }
    .event-logo-placeholder-small {
      width: 40px;
      height: 40px;
      border-radius: 8px;
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
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.875rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    .action-btn:hover {
      background: #2563eb;
    }
    .action-btn svg {
      width: 16px;
      height: 16px;
    }
    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: #64748b;
      background: white;
      border-radius: 12px;
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

      <div *ngIf="loadingActive" class="loading">
        {{ 'MY_EVENTS.LOADING_ACTIVE' | translate }}
      </div>

      <div *ngIf="!loadingActive && activeEvents.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3>{{ 'MY_EVENTS.NO_ACTIVE_EVENTS' | translate }}</h3>
        <p>{{ 'MY_EVENTS.NO_ACTIVE_EVENTS_DESC' | translate }}</p>
      </div>

      <div *ngIf="!loadingActive && activeEvents.length > 0" class="table-container">
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
            <tr *ngFor="let event of activeEvents">
              <td>
                <div class="event-name-cell">
                  <img *ngIf="event.logoPath" [src]="getLogoUrl(event.logoPath)" class="event-logo-small" [alt]="event.name">
                  <div *ngIf="!event.logoPath" class="event-logo-placeholder-small">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span>{{ event.name }}</span>
                </div>
              </td>
              <td>{{ formatDate(event.startDate) }}</td>
              <td>{{ formatDate(event.endDate) }}</td>
              <td><span class="status-active">{{ 'MY_EVENTS.STATUS_ACTIVE' | translate }}</span></td>
              <td>
                <a [href]="'/event/' + event.id + '/orders'" target="_blank" class="action-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {{ 'MY_EVENTS.VIEW_ORDERS' | translate }}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class MyEventsComponent implements OnInit {
  activeEvents: Event[] = [];
  loadingActive = true;

  private apiUrl = `${environment.apiUrl}/api/events`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadActiveEvents();
  }

  loadActiveEvents(): void {
    this.loadingActive = true;
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '100');

    this.http.get<PageResponse<Event>>(`${this.apiUrl}/my-events/active`, { params })
      .subscribe({
        next: (response) => {
          this.activeEvents = response.content;
          this.loadingActive = false;
        },
        error: (err) => {
          console.error('Error loading active events:', err);
          this.activeEvents = [];
          this.loadingActive = false;
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