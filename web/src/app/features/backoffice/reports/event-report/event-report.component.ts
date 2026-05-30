import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrderService, Order, OrderPayment } from '../../orders/order.service';
import { EventService, Event } from '../../clients/event.service';

/** One payment line shown under an order. */
interface PayLine {
  method: string;
  amount: number;
  paidAt?: string;
  receipt?: string;
}

/** One order row inside a user's table. */
interface OrderRow {
  orderNo: number;
  date: string;
  payments: PayLine[];
  tip: number;
  total: number;        // net + tip
  totalWithVat: number; // net + VAT + tip (gross)
}

/** All orders a single user collected, with that user's running totals. */
interface UserGroup {
  user: string;
  orders: OrderRow[];
  totalCash: number;
  totalCard: number;
  totalTips: number;
}

@Component({
  selector: 'app-event-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="page-header">
      <div class="page-header-left">
        <h5>{{ 'REPORTS.EVENT.TITLE' | translate }}</h5>
        <ul class="breadcrumb">
          <li class="breadcrumb-item"><a href="/">Home</a></li>
          <li class="breadcrumb-item">{{ 'NAV.REPORTS' | translate }}</li>
          <li class="breadcrumb-item">{{ 'REPORTS.EVENT.TITLE' | translate }}</li>
        </ul>
      </div>
    </div>

    <div class="card stretch">
      <div class="card-header">
        <div class="header-controls">
          <span class="filter-label">{{ 'REPORTS.EVENT.SELECT_EVENT' | translate }}</span>
          <select class="event-select" [(ngModel)]="selectedEventId" (ngModelChange)="onEventChange()">
            <option [ngValue]="null">—</option>
            @for (ev of events; track ev.id) {
              <option [ngValue]="ev.id">{{ ev.name }}</option>
            }
          </select>
        </div>
        <button class="export-btn" [disabled]="userGroups.length === 0" (click)="exportPdf()">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
          </svg>
          {{ 'REPORTS.EVENT.EXPORT_PDF' | translate }}
        </button>
      </div>

      <div class="card-body">
        @if (loading) {
          <div class="state">{{ 'COMMON.LOADING' | translate }}</div>
        } @else if (!selectedEventId) {
          <div class="state">{{ 'REPORTS.EVENT.NO_EVENT' | translate }}</div>
        } @else if (userGroups.length === 0) {
          <div class="state">{{ 'REPORTS.EVENT.NO_DATA' | translate }}</div>
        } @else {
          <div id="event-report-print">
            <h2 class="print-only report-title">{{ selectedEventName }}</h2>
            @for (group of userGroups; track group.user) {
              <div class="user-block">
                <h3 class="user-title">{{ group.user }}</h3>
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>{{ 'ORDERS.ORDER_NO' | translate }}</th>
                      <th>{{ 'REPORTS.EVENT.DATE' | translate }}</th>
                      <th>{{ 'REPORTS.EVENT.PAYMENTS' | translate }}</th>
                      <th class="text-end">{{ 'REPORTS.EVENT.TIP' | translate }}</th>
                      <th class="text-end">{{ 'REPORTS.EVENT.TOTAL' | translate }}</th>
                      <th class="text-end">{{ 'REPORTS.EVENT.TOTAL_WITH_VAT' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (order of group.orders; track order.orderNo) {
                      <tr>
                        <td class="fw-semibold">#{{ order.orderNo }}</td>
                        <td class="muted">{{ formatDate(order.date) }}</td>
                        <td>
                          @for (p of order.payments; track $index) {
                            <span class="pay-chip" [class.cash]="p.method === 'CASH'" [class.card]="p.method === 'CARD'">
                              {{ methodLabel(p.method) }} {{ money(p.amount) }}
                              @if (p.receipt) {
                                <span class="receipt-no" title="Fiscal receipt">· #{{ p.receipt }}</span>
                              }
                            </span>
                          }
                        </td>
                        <td class="text-end">{{ order.tip ? money(order.tip) : '-' }}</td>
                        <td class="text-end">{{ money(order.total) }}</td>
                        <td class="text-end fw-semibold">{{ money(order.totalWithVat) }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="user-totals">
                      <td colspan="2" class="fw-semibold">{{ group.user }}</td>
                      <td class="totals-cells">
                        <span class="tot"><b>{{ 'REPORTS.EVENT.TOTAL_CASH' | translate }}:</b> {{ money(group.totalCash) }}</span>
                        <span class="tot"><b>{{ 'REPORTS.EVENT.TOTAL_CARD' | translate }}:</b> {{ money(group.totalCard) }}</span>
                        <span class="tot"><b>{{ 'REPORTS.EVENT.TOTAL_TIPS' | translate }}:</b> {{ money(group.totalTips) }}</span>
                      </td>
                      <td colspan="3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }

            <div class="grand-totals">
              <span class="grand-label">{{ 'REPORTS.EVENT.GRAND_TOTAL' | translate }}</span>
              <span class="grand"><b>{{ 'REPORTS.EVENT.TOTAL_CASH' | translate }}:</b> {{ money(grandCash) }}</span>
              <span class="grand"><b>{{ 'REPORTS.EVENT.TOTAL_CARD' | translate }}:</b> {{ money(grandCard) }}</span>
              <span class="grand"><b>{{ 'REPORTS.EVENT.TOTAL_TIPS' | translate }}:</b> {{ money(grandTips) }}</span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .card { background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-radius: 0; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--border-color); gap: 16px; flex-wrap: wrap; }
    .header-controls { display: flex; align-items: center; gap: 10px; }
    .filter-label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
    .event-select { padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 0; font-size: 13px; background: white; color: var(--text-dark); min-width: 220px; }
    .export-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--primary); background: var(--primary); color: white; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 0; }
    .export-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .export-btn svg { width: 16px; height: 16px; }
    .card-body { padding: 16px 20px; }

    .state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; }

    .user-block { margin-bottom: 28px; }
    .user-title { font-size: 15px; font-weight: 700; color: var(--text-dark); margin: 0 0 8px; padding-bottom: 6px; border-bottom: 2px solid var(--primary); }

    .report-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .report-table th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 1px solid var(--border-color); background: #f8fafc; }
    .report-table td { padding: 8px 12px; border-bottom: 1px solid var(--border-color); vertical-align: top; color: var(--text-dark); }
    .text-end { text-align: right; }
    .fw-semibold { font-weight: 600; }
    .muted { color: var(--text-muted); }

    .pay-chip { display: inline-block; margin: 1px 4px 1px 0; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569; font-variant-numeric: tabular-nums; }
    .pay-chip.cash { background: rgba(76,175,80,0.15); color: #2E7D32; }
    .pay-chip.card { background: rgba(33,150,243,0.15); color: #1565C0; }
    .pay-chip .receipt-no { font-weight: 500; opacity: 0.75; margin-left: 2px; }

    .user-totals td { background: #f8fafc; border-top: 2px solid var(--border-color); }
    .totals-cells { display: flex; gap: 16px; flex-wrap: wrap; }
    .tot { font-size: 13px; color: var(--text-dark); font-variant-numeric: tabular-nums; }

    .grand-totals { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-top: 8px; padding: 14px 16px; background: #f1f5f9; border: 1px solid var(--border-color); }
    .grand-label { font-size: 14px; font-weight: 700; color: var(--text-dark); }
    .grand { font-size: 14px; color: var(--text-dark); font-variant-numeric: tabular-nums; }

    .print-only { display: none; }
  `]
})
export class EventReportComponent implements OnInit {
  events: Event[] = [];
  selectedEventId: string | null = null;
  selectedEventName = '';
  loading = false;

  userGroups: UserGroup[] = [];
  grandCash = 0;
  grandCard = 0;
  grandTips = 0;

  constructor(
    private orderService: OrderService,
    private eventService: EventService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.eventService.getMyEvents(0, 200).subscribe({
      next: (res) => { this.events = res.content || []; },
      error: () => { this.events = []; }
    });
  }

  onEventChange(): void {
    this.userGroups = [];
    this.grandCash = this.grandCard = this.grandTips = 0;
    if (!this.selectedEventId) {
      this.selectedEventName = '';
      return;
    }
    this.selectedEventName = this.events.find(e => e.id === this.selectedEventId)?.name || '';
    this.loadOrders(this.selectedEventId);
  }

  private loadOrders(eventId: string): void {
    this.loading = true;
    // Pull every order for the event (large page) so the report is complete.
    this.orderService.getOrders(0, 5000, undefined, undefined, eventId).subscribe({
      next: (res) => {
        this.build(res.content || []);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private build(orders: Order[]): void {
    const byUser = new Map<string, OrderRow[]>();

    for (const o of orders) {
      const payments = this.resolvePayments(o);
      if (payments.length === 0) continue; // unpaid → not in this report

      const user = o.paidBy || payments[0]?.paidBy || '—';
      const net = (o.netAmount ?? o.totalAmount ?? 0);
      const vat = (o.vatAmount ?? 0);
      const tip = o.tip || 0;
      const row: OrderRow = {
        orderNo: o.orderNo,
        date: o.paidAt || o.createdAt,
        payments: payments.map(p => ({
          method: (p.paymentMethod || '—').toUpperCase(),
          amount: p.amount || 0,
          paidAt: p.paidAt,
          receipt: p.receiptNumber || p.fiscalReceiptId || undefined
        })),
        tip,
        total: net + tip,
        totalWithVat: net + vat + tip
      };
      const arr = byUser.get(user) || [];
      arr.push(row);
      byUser.set(user, arr);
    }

    let gc = 0, gd = 0, gt = 0;
    this.userGroups = Array.from(byUser.entries()).map(([user, rows]) => {
      rows.sort((a, b) => a.orderNo - b.orderNo);
      let totalCash = 0, totalCard = 0, totalTips = 0;
      for (const ord of rows) {
        for (const p of ord.payments) {
          if (p.method === 'CASH') totalCash += p.amount;
          else if (p.method === 'CARD') totalCard += p.amount;
        }
        totalTips += ord.tip;
      }
      gc += totalCash; gd += totalCard; gt += totalTips;
      return { user, orders: rows, totalCash, totalCard, totalTips };
    }).sort((a, b) => a.user.localeCompare(b.user));

    this.grandCash = gc;
    this.grandCard = gd;
    this.grandTips = gt;
  }

  /**
   * Payments backing an order. Prefer the recorded per-payment breakdown;
   * fall back to a single synthesized payment for legacy paid orders that
   * predate payment-record tracking.
   */
  private resolvePayments(o: Order): OrderPayment[] {
    if (o.payments && o.payments.length > 0) {
      // A payment with no per-row receipt (e.g. card) falls back to the order-level one.
      return o.payments.map(p => ({
        ...p,
        receiptNumber: p.receiptNumber ?? o.receiptNumber,
        fiscalReceiptId: p.fiscalReceiptId ?? o.fiscalReceiptId
      }));
    }
    if (o.paidBy || o.paymentMethod) {
      return [{
        amount: o.netAmount ?? o.totalAmount ?? 0, paymentMethod: o.paymentMethod, paidBy: o.paidBy, paidAt: o.paidAt,
        receiptNumber: o.receiptNumber, fiscalReceiptId: o.fiscalReceiptId
      }];
    }
    return [];
  }

  methodLabel(method: string): string {
    switch (method) {
      case 'CASH': return 'Cash';
      case 'CARD': return 'Card';
      case 'ONLINE': return 'Online';
      case 'PROTOCOL': return 'Protocol';
      default: return method;
    }
  }

  money(value: number): string {
    return `${(value || 0).toFixed(2)} RON`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** Render the report into a standalone window and trigger the browser's
   *  print dialog, where the user picks "Save as PDF". Needs no PDF library. */
  exportPdf(): void {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(this.buildPrintHtml());
    win.document.close();
    win.focus();
    // Give the new document a tick to lay out before printing.
    setTimeout(() => win.print(), 250);
  }

  private buildPrintHtml(): string {
    const esc = (s: string) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const t = (k: string) => this.translate.instant(k);

    let body = `<h1>${esc(this.selectedEventName)}</h1>`;
    for (const g of this.userGroups) {
      body += `<h2>${esc(g.user)}</h2>`;
      body += `<table><thead><tr>
        <th>${t('ORDERS.ORDER_NO')}</th><th>${t('REPORTS.EVENT.DATE')}</th>
        <th>${t('REPORTS.EVENT.PAYMENTS')}</th><th class="r">${t('REPORTS.EVENT.TIP')}</th>
        <th class="r">${t('REPORTS.EVENT.TOTAL')}</th><th class="r">${t('REPORTS.EVENT.TOTAL_WITH_VAT')}</th></tr></thead><tbody>`;
      for (const o of g.orders) {
        const pays = o.payments.map(p => `${this.methodLabel(p.method)} ${this.money(p.amount)}${p.receipt ? ` (#${p.receipt})` : ''}`).join(', ');
        body += `<tr><td>#${o.orderNo}</td><td>${esc(this.formatDate(o.date))}</td><td>${esc(pays)}</td>
          <td class="r">${o.tip ? this.money(o.tip) : '-'}</td><td class="r">${this.money(o.total)}</td>
          <td class="r">${this.money(o.totalWithVat)}</td></tr>`;
      }
      body += `</tbody></table>`;
      body += `<p class="tot"><b>${t('REPORTS.EVENT.TOTAL_CASH')}:</b> ${this.money(g.totalCash)} &nbsp;
        <b>${t('REPORTS.EVENT.TOTAL_CARD')}:</b> ${this.money(g.totalCard)} &nbsp;
        <b>${t('REPORTS.EVENT.TOTAL_TIPS')}:</b> ${this.money(g.totalTips)}</p>`;
    }
    body += `<div class="grand"><b>${t('REPORTS.EVENT.GRAND_TOTAL')}</b> &nbsp;
      <b>${t('REPORTS.EVENT.TOTAL_CASH')}:</b> ${this.money(this.grandCash)} &nbsp;
      <b>${t('REPORTS.EVENT.TOTAL_CARD')}:</b> ${this.money(this.grandCard)} &nbsp;
      <b>${t('REPORTS.EVENT.TOTAL_TIPS')}:</b> ${this.money(this.grandTips)}</div>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(this.selectedEventName)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; padding: 24px; }
        h1 { font-size: 20px; margin: 0 0 16px; }
        h2 { font-size: 15px; margin: 20px 0 6px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 4px; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
        .r { text-align: right; }
        .tot { font-size: 12px; margin: 2px 0 8px; }
        .grand { margin-top: 16px; padding: 10px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 13px; }
        @media print { @page { margin: 14mm; } }
      </style></head><body>${body}</body></html>`;
  }
}
