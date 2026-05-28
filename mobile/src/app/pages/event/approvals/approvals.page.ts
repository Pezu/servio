import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, personOutline, storefrontOutline } from 'ionicons/icons';
import { OrderService, ProtocolPaymentSummary } from '../../../services/order.service';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent
  ],
  template: `
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="state-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (rows.length === 0) {
        <div class="state-container">
          <ion-icon name="document-text-outline"></ion-icon>
          <p>No protocol payments yet.</p>
        </div>
      } @else {
        <div class="rows">
          @for (row of rows; track row.orderId) {
            <div class="row-card">
              <div class="row-head">
                <div class="row-head-left">
                  <ion-icon name="storefront-outline"></ion-icon>
                  <span class="op-name">{{ row.orderPointName || '—' }}</span>
                  @if (row.clientName) {
                    <span class="client-name">· {{ row.clientName }}</span>
                  }
                </div>
                <span class="row-amount">{{ formatPrice(row.totalAmount) }}</span>
              </div>
              <div class="row-meta">
                <span class="meta-user">
                  <ion-icon name="person-outline"></ion-icon>
                  {{ row.paidBy || '—' }}
                </span>
                @if (row.paidAt) {
                  <span class="meta-time">{{ formatTime(row.paidAt) }}</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    ion-content {
      --background: #ffffff;
    }

    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #64748b;
    }

    .state-container ion-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.55;
    }

    .state-container p {
      margin: 0;
      font-size: 14px;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .row-card {
      padding: 14px 16px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .row-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .row-head-left {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #1e293b;
      min-width: 0;
    }

    .row-head-left ion-icon {
      font-size: 18px;
      color: var(--ion-color-primary);
      flex-shrink: 0;
    }

    .op-name {
      font-weight: 600;
      font-size: 15px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .client-name {
      color: #64748b;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-amount {
      font-weight: 700;
      color: #b45309;
      font-size: 15px;
      flex-shrink: 0;
    }

    .row-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #64748b;
      font-size: 13px;
    }

    .meta-user {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .meta-user ion-icon {
      font-size: 14px;
    }
  `]
})
export class ApprovalsPage implements OnInit {
  eventId = '';
  loading = true;
  rows: ProtocolPaymentSummary[] = [];

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService
  ) {
    addIcons({ documentTextOutline, personOutline, storefrontOutline });
  }

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    this.load();
  }

  refresh(ev: RefresherCustomEvent): void {
    this.load(() => ev.target.complete());
  }

  load(done?: () => void): void {
    this.loading = true;
    this.orderService.getProtocolPayments(this.eventId).subscribe({
      next: (rows) => {
        this.rows = rows || [];
        this.loading = false;
        done?.();
      },
      error: (err) => {
        console.error('[Approvals] failed to load:', err);
        this.rows = [];
        this.loading = false;
        done?.();
      }
    });
  }

  formatPrice(value: number): string {
    if (value == null) return '—';
    return value === Math.floor(value)
      ? `${value.toFixed(0)} RON`
      : `${value.toFixed(2)} RON`;
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}