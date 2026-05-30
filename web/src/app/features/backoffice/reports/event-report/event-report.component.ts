import { Component, OnInit, HostListener } from '@angular/core';
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
  total: number;         // net (no VAT, no tip)
  totalWithVat: number;  // net + VAT (no tip)
  totalWithTips: number; // net + VAT + tip
}

/** All orders a single user collected, with that user's running totals. */
interface UserGroup {
  user: string;
  orders: OrderRow[];
  totalCash: number;
  totalCard: number;
  totalTipsCash: number;
  totalTipsCard: number;
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
          <div class="custom-select event-select-custom" [class.open]="eventDropdownOpen" (click)="toggleEventDropdown(); $event.stopPropagation()">
            <div class="custom-select-trigger">
              <span class="selected-value" [class.placeholder]="!selectedEventName">
                {{ selectedEventName || ('REPORTS.EVENT.SELECT_EVENT' | translate) }}
              </span>
              <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            @if (eventDropdownOpen) {
              <div class="custom-select-options square">
                @for (ev of events; track ev.id) {
                  <div class="custom-select-option" [class.selected]="ev.id === selectedEventId" (click)="selectEvent(ev); $event.stopPropagation()">
                    <span class="option-text">{{ ev.name }}</span>
                    @if (ev.id === selectedEventId) {
                      <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    }
                  </div>
                }
              </div>
            }
          </div>
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
                      <th class="text-end">{{ 'REPORTS.EVENT.TOTAL_WITH_TIPS' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (order of group.orders; track order.orderNo) {
                      <tr>
                        <td class="fw-semibold">#{{ order.orderNo }}</td>
                        <td class="muted">{{ formatDate(order.date) }}</td>
                        <td class="pay-cell">
                          <table class="pay-table">
                            <tbody>
                              @for (p of order.payments; track $index) {
                                <tr>
                                  <td class="pay-type">
                                    {{ methodLabel(p.method) }}
                                    @if (p.receipt) {
                                      <span class="receipt-no" title="Fiscal receipt">· #{{ p.receipt }}</span>
                                    }
                                  </td>
                                  <td class="pay-amt">{{ money(p.amount) }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </td>
                        <td class="text-end">{{ order.tip ? money(order.tip) : '-' }}</td>
                        <td class="text-end">{{ money(order.total) }}</td>
                        <td class="text-end">{{ money(order.totalWithVat) }}</td>
                        <td class="text-end fw-semibold">{{ money(order.totalWithTips) }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="user-totals">
                      <td colspan="2" class="fw-semibold">{{ group.user }}</td>
                      <td class="totals-cells">
                        <span class="tot"><b>{{ 'REPORTS.EVENT.TOTAL_CASH' | translate }}:</b> {{ money(group.totalCash) }}</span>
                        <span class="tot"><b>{{ 'REPORTS.EVENT.TOTAL_CARD' | translate }}:</b> {{ money(group.totalCard) }}</span>
                        <span class="tot"><b>{{ 'REPORTS.EVENT.TOTAL_TIPS_CARD' | translate }}:</b> {{ money(group.totalTipsCard) }}</span>
                        <span class="tot"><b>{{ 'REPORTS.EVENT.TOTAL_TIPS_CASH' | translate }}:</b> {{ money(group.totalTipsCash) }}</span>
                      </td>
                      <td colspan="4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }

            <div class="grand-totals">
              <span class="grand-label">{{ 'REPORTS.EVENT.GRAND_TOTAL' | translate }}</span>
              <span class="grand"><b>{{ 'REPORTS.EVENT.TOTAL_CASH' | translate }}:</b> {{ money(grandCash) }}</span>
              <span class="grand"><b>{{ 'REPORTS.EVENT.TOTAL_CARD' | translate }}:</b> {{ money(grandCard) }}</span>
              <span class="grand"><b>{{ 'REPORTS.EVENT.TOTAL_TIPS_CARD' | translate }}:</b> {{ money(grandTipsCard) }}</span>
              <span class="grand"><b>{{ 'REPORTS.EVENT.TOTAL_TIPS_CASH' | translate }}:</b> {{ money(grandTipsCash) }}</span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .card { background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-radius: 0; }
    .card.stretch { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--border-color); gap: 16px; flex-wrap: wrap; flex-shrink: 0; }
    .header-controls { display: flex; align-items: center; gap: 10px; }
    .filter-label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
    /* Custom select popup (matches clients/locations/revenue) */
    .custom-select { position: relative; cursor: pointer; }
    .custom-select-trigger { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; background: white; border: 1px solid var(--border-color); border-radius: 0; font-size: 13px; color: var(--text-dark); transition: all 0.2s ease; }
    .custom-select:hover .custom-select-trigger { border-color: #cbd5e1; }
    .custom-select.open .custom-select-trigger { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .custom-select .selected-value { display: flex; align-items: center; gap: 8px; }
    .custom-select .selected-value.placeholder { color: var(--text-muted); }
    .custom-select .dropdown-arrow { width: 14px; height: 14px; color: var(--text-muted); transition: transform 0.2s ease; flex-shrink: 0; }
    .custom-select.open .dropdown-arrow { transform: rotate(180deg); }
    .custom-select-options { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid var(--border-color); border-radius: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.12); z-index: 1100; overflow-y: auto; max-height: 320px; }
    .custom-select-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 13px; color: var(--text-dark); cursor: pointer; transition: background 0.15s ease; }
    .custom-select-option:hover { background: var(--bg-light); }
    .custom-select-option.selected { background: rgba(59, 130, 246, 0.08); color: var(--primary); font-weight: 500; }
    .custom-select-option .option-text { flex: 1; }
    .custom-select-option .check-icon { width: 16px; height: 16px; color: var(--primary); margin-left: auto; }
    .custom-select.event-select-custom { min-width: 260px; }
    .export-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--primary); background: var(--primary); color: white; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 0; }
    .export-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .export-btn svg { width: 16px; height: 16px; }
    .card-body { padding: 16px 20px; flex: 1; min-height: 0; overflow-y: auto; }

    .state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; }

    .user-block { margin-bottom: 28px; }
    .user-title { font-size: 15px; font-weight: 700; color: var(--text-dark); margin: 0 0 8px; padding-bottom: 6px; border-bottom: 2px solid var(--primary); }

    .report-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .report-table th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border: 1px solid var(--border-color); background: #f8fafc; }
    .report-table td { padding: 8px 12px; border: 1px solid var(--border-color); vertical-align: top; color: var(--text-dark); }
    .text-end { text-align: right; }
    .fw-semibold { font-weight: 600; }
    .muted { color: var(--text-muted); }

    /* Payments split into rows of [type | amount] within the cell. */
    .pay-cell { padding: 0; }
    .pay-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .pay-table td { border: 1px solid var(--border-color); padding: 5px 8px; }
    .pay-table tr:first-child td { border-top: none; }
    .pay-table tr:last-child td { border-bottom: none; }
    .pay-table td:first-child { border-left: none; }
    .pay-table td:last-child { border-right: none; }
    .pay-table .pay-type { font-weight: 600; color: #475569; }
    .pay-table .pay-amt { text-align: right; white-space: nowrap; width: 1%; font-variant-numeric: tabular-nums; }
    .pay-table .receipt-no { font-weight: 500; color: var(--text-muted); margin-left: 2px; }

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

  eventDropdownOpen = false;

  userGroups: UserGroup[] = [];
  grandCash = 0;
  grandCard = 0;
  grandTipsCash = 0;
  grandTipsCard = 0;

  constructor(
    private orderService: OrderService,
    private eventService: EventService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.eventService.getMyEvents(0, 200).subscribe({
      next: (res) => {
        this.events = res.content || [];
        // Single event → pre-select it.
        if (this.events.length === 1 && this.events[0].id) {
          this.selectedEventId = this.events[0].id;
          this.onEventChange();
        }
      },
      error: () => { this.events = []; }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.eventDropdownOpen = false;
  }

  toggleEventDropdown(): void {
    this.eventDropdownOpen = !this.eventDropdownOpen;
  }

  selectEvent(ev: Event): void {
    this.eventDropdownOpen = false;
    if (ev.id && ev.id !== this.selectedEventId) {
      this.selectedEventId = ev.id;
      this.onEventChange();
    }
  }

  onEventChange(): void {
    this.userGroups = [];
    this.grandCash = this.grandCard = this.grandTipsCash = this.grandTipsCard = 0;
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
        total: net,
        totalWithVat: net + vat,
        totalWithTips: net + vat + tip
      };
      const arr = byUser.get(user) || [];
      arr.push(row);
      byUser.set(user, arr);
    }

    let gc = 0, gd = 0, gtCash = 0, gtCard = 0;
    this.userGroups = Array.from(byUser.entries()).map(([user, rows]) => {
      rows.sort((a, b) => a.orderNo - b.orderNo);
      let totalCash = 0, totalCard = 0, totalTipsCash = 0, totalTipsCard = 0;
      for (const ord of rows) {
        let cashAmt = 0, cardAmt = 0;
        for (const p of ord.payments) {
          if (p.method === 'CASH') { totalCash += p.amount; cashAmt += p.amount; }
          else if (p.method === 'CARD') { totalCard += p.amount; cardAmt += p.amount; }
        }
        // Attribute the order's tip to card/cash by its card/cash payment split;
        // card gets its proportional share, cash absorbs the rounding remainder.
        if (ord.tip > 0) {
          const base = cashAmt + cardAmt;
          if (base > 0) {
            const tipCard = Math.round((ord.tip * cardAmt / base) * 100) / 100;
            totalTipsCard += tipCard;
            totalTipsCash += Math.round((ord.tip - tipCard) * 100) / 100;
          } else {
            totalTipsCash += ord.tip; // no card/cash payment to attribute to → treat as cash
          }
        }
      }
      totalTipsCash = Math.round(totalTipsCash * 100) / 100;
      totalTipsCard = Math.round(totalTipsCard * 100) / 100;
      gc += totalCash; gd += totalCard; gtCash += totalTipsCash; gtCard += totalTipsCard;
      return { user, orders: rows, totalCash, totalCard, totalTipsCash, totalTipsCard };
    }).sort((a, b) => a.user.localeCompare(b.user));

    this.grandCash = gc;
    this.grandCard = gd;
    this.grandTipsCash = Math.round(gtCash * 100) / 100;
    this.grandTipsCard = Math.round(gtCard * 100) / 100;
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
        <th class="r">${t('REPORTS.EVENT.TOTAL')}</th><th class="r">${t('REPORTS.EVENT.TOTAL_WITH_VAT')}</th>
        <th class="r">${t('REPORTS.EVENT.TOTAL_WITH_TIPS')}</th></tr></thead><tbody>`;
      for (const o of g.orders) {
        const pays = `<table class="pt"><tbody>` + o.payments.map(p =>
          `<tr><td>${esc(this.methodLabel(p.method))}${p.receipt ? ` <span class="rc">· #${esc(p.receipt)}</span>` : ''}</td><td class="r">${this.money(p.amount)}</td></tr>`
        ).join('') + `</tbody></table>`;
        body += `<tr><td>#${o.orderNo}</td><td>${esc(this.formatDate(o.date))}</td><td class="pc">${pays}</td>
          <td class="r">${o.tip ? this.money(o.tip) : '-'}</td><td class="r">${this.money(o.total)}</td>
          <td class="r">${this.money(o.totalWithVat)}</td><td class="r">${this.money(o.totalWithTips)}</td></tr>`;
      }
      body += `</tbody></table>`;
      body += `<p class="tot"><b>${t('REPORTS.EVENT.TOTAL_CASH')}:</b> ${this.money(g.totalCash)} &nbsp;
        <b>${t('REPORTS.EVENT.TOTAL_CARD')}:</b> ${this.money(g.totalCard)} &nbsp;
        <b>${t('REPORTS.EVENT.TOTAL_TIPS_CARD')}:</b> ${this.money(g.totalTipsCard)} &nbsp;
        <b>${t('REPORTS.EVENT.TOTAL_TIPS_CASH')}:</b> ${this.money(g.totalTipsCash)}</p>`;
    }
    body += `<div class="grand"><b>${t('REPORTS.EVENT.GRAND_TOTAL')}</b> &nbsp;
      <b>${t('REPORTS.EVENT.TOTAL_CASH')}:</b> ${this.money(this.grandCash)} &nbsp;
      <b>${t('REPORTS.EVENT.TOTAL_CARD')}:</b> ${this.money(this.grandCard)} &nbsp;
      <b>${t('REPORTS.EVENT.TOTAL_TIPS_CARD')}:</b> ${this.money(this.grandTipsCard)} &nbsp;
      <b>${t('REPORTS.EVENT.TOTAL_TIPS_CASH')}:</b> ${this.money(this.grandTipsCash)}</div>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(this.selectedEventName)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; padding: 24px; }
        h1 { font-size: 20px; margin: 0 0 16px; }
        h2 { font-size: 15px; margin: 20px 0 6px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 4px; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
        td.pc { padding: 0; }
        .pt { width: 100%; border-collapse: collapse; }
        .pt td { border: 1px solid #cbd5e1; padding: 3px 6px; }
        .pt tr:first-child td { border-top: none; }
        .pt tr:last-child td { border-bottom: none; }
        .pt td:first-child { border-left: none; }
        .pt td:last-child { border-right: none; white-space: nowrap; }
        .pt .rc { color: #64748b; }
        .r { text-align: right; }
        .tot { font-size: 12px; margin: 2px 0 8px; }
        .grand { margin-top: 16px; padding: 10px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 13px; }
        @media print { @page { margin: 14mm; } }
      </style></head><body>${body}</body></html>`;
  }
}
