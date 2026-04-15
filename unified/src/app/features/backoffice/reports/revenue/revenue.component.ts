import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { OrderService, Order, PageResponse } from '../../orders/order.service';

// Custom date adapter for dd-MM-yyyy format
class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'input') {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return date.toDateString();
  }

  override parse(value: any): Date | null {
    if (typeof value === 'string' && value.includes('-')) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    return super.parse(value);
  }
}

const CUSTOM_DATE_FORMATS = {
  parse: { dateInput: 'input' },
  display: {
    dateInput: 'input',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' }
  }
};

@Component({
  selector: 'app-revenue',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatDatepickerModule, MatInputModule, MatFormFieldModule],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS }
  ],
  template: `
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-left d-flex align-items-center">
        <div class="page-header-title">
          <h5>{{ 'REPORTS.REVENUE.TITLE' | translate }}</h5>
        </div>
        <ul class="breadcrumb">
          <li class="breadcrumb-item"><a href="/">Home</a></li>
          <li class="breadcrumb-item">{{ 'NAV.REPORTS' | translate }}</li>
          <li class="breadcrumb-item">{{ 'REPORTS.REVENUE.TITLE' | translate }}</li>
        </ul>
      </div>
    </div>

    <!-- Revenue Table -->
    <div class="card">
      <div class="card-header">
        <h5 class="card-title">{{ 'REPORTS.REVENUE.ALL_PAYMENTS' | translate }}</h5>
        <div class="filter-section">
          <div class="filter-group">
            <span class="filter-label">{{ 'ORDERS.FROM' | translate }}</span>
            <mat-form-field class="date-field" appearance="outline">
              <input matInput [matDatepicker]="startPicker" [(ngModel)]="startDate" (dateChange)="onFilterChange()" placeholder="Select date">
              <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>
          </div>
          <div class="filter-group">
            <span class="filter-label">{{ 'ORDERS.TO' | translate }}</span>
            <mat-form-field class="date-field" appearance="outline">
              <input matInput [matDatepicker]="endPicker" [(ngModel)]="endDate" (dateChange)="onFilterChange()" placeholder="Select date">
              <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
            </mat-form-field>
          </div>
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive" (click)="closeAllFilters()">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>{{ 'ORDERS.ORDER_NO' | translate }}</th>
                <th>{{ 'ORDERS.EVENT' | translate }}</th>
                <th>{{ 'ORDER_POINTS.TITLE' | translate }}</th>
                <th class="filter-header">
                  <div class="filter-header-content" (click)="toggleStatusFilter($event)">
                    {{ 'REPORTS.REVENUE.PAID_STATUS' | translate }}
                    <svg class="filter-icon" [class.active]="selectedStatuses.size > 0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                    </svg>
                  </div>
                  @if (showStatusFilter) {
                    <div class="filter-dropdown" (click)="$event.stopPropagation()">
                      <div class="filter-actions">
                        <button type="button" class="filter-action-btn" (click)="selectAllStatuses()">Select All</button>
                        <button type="button" class="filter-action-btn" (click)="clearStatusFilter()">Clear</button>
                      </div>
                      <div class="filter-options">
                        @for (status of availableStatuses; track status) {
                          <label class="filter-option">
                            <input type="checkbox" [checked]="selectedStatuses.has(status)" (change)="toggleStatus(status)">
                            <span>{{ getStatusLabel(status) }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  }
                </th>
                <th class="filter-header">
                  <div class="filter-header-content" (click)="togglePaymentMethodFilter($event)">
                    {{ 'REPORTS.REVENUE.PAYMENT_METHOD' | translate }}
                    <svg class="filter-icon" [class.active]="selectedPaymentMethods.size > 0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                    </svg>
                  </div>
                  @if (showPaymentMethodFilter) {
                    <div class="filter-dropdown" (click)="$event.stopPropagation()">
                      <div class="filter-actions">
                        <button type="button" class="filter-action-btn" (click)="selectAllPaymentMethods()">Select All</button>
                        <button type="button" class="filter-action-btn" (click)="clearPaymentMethodFilter()">Clear</button>
                      </div>
                      <div class="filter-options">
                        @for (method of availablePaymentMethods; track method) {
                          <label class="filter-option">
                            <input type="checkbox" [checked]="selectedPaymentMethods.has(method)" (change)="togglePaymentMethod(method)">
                            <span>{{ getPaymentMethodLabel(method) }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  }
                </th>
                <th class="filter-header">
                  <div class="filter-header-content" (click)="toggleOperatorFilter($event)">
                    {{ 'REPORTS.REVENUE.OPERATOR' | translate }}
                    <svg class="filter-icon" [class.active]="selectedOperators.size > 0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                    </svg>
                  </div>
                  @if (showOperatorFilter) {
                    <div class="filter-dropdown" (click)="$event.stopPropagation()">
                      <div class="filter-actions">
                        <button type="button" class="filter-action-btn" (click)="selectAllOperators()">Select All</button>
                        <button type="button" class="filter-action-btn" (click)="clearOperatorFilter()">Clear</button>
                      </div>
                      <div class="filter-options">
                        @for (operator of availableOperators; track operator) {
                          <label class="filter-option">
                            <input type="checkbox" [checked]="selectedOperators.has(operator)" (change)="toggleOperator(operator)">
                            <span>{{ operator }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  }
                </th>
                <th>{{ 'REPORTS.REVENUE.DATE' | translate }}</th>
                <th class="text-end">{{ 'REPORTS.REVENUE.NET_AMOUNT' | translate }}</th>
                <th class="text-end">{{ 'REPORTS.REVENUE.VAT' | translate }}</th>
                <th class="text-end">{{ 'REPORTS.REVENUE.TIP' | translate }}</th>
                <th class="text-end">{{ 'REPORTS.REVENUE.TOTAL' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr><td colspan="11" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
              } @else if (filteredOrders.length === 0) {
                <tr><td colspan="11" class="text-center py-4 text-muted">{{ 'REPORTS.REVENUE.NO_RECORDS' | translate }}</td></tr>
              } @else {
                @for (order of filteredOrders; track order.id) {
                  <tr>
                    <td><span class="fw-semibold">#{{ order.orderNo }}</span></td>
                    <td class="text-muted">{{ order.eventName || '-' }}</td>
                    <td class="text-muted">{{ order.orderPointName || '-' }}</td>
                    <td>
                      <span class="paid-badge" [class.paid]="!order.needsPayment" [class.unpaid]="order.needsPayment">
                        {{ order.needsPayment ? ('ORDERS.UNPAID' | translate) : ('ORDERS.PAID_STATUS' | translate) }}
                      </span>
                    </td>
                    <td>
                      @if (order.paymentMethod) {
                        <span class="payment-method-badge"
                              [class.cash]="order.paymentMethod === 'CASH'"
                              [class.card]="order.paymentMethod === 'CARD'"
                              [class.online]="order.paymentMethod === 'ONLINE'">
                          {{ getPaymentMethodLabel(order.paymentMethod) }}
                        </span>
                      } @else {
                        <span class="text-muted">-</span>
                      }
                    </td>
                    <td class="text-muted">{{ order.paidBy || '-' }}</td>
                    <td class="text-muted">{{ order.paidAt ? formatDate(order.paidAt) : '-' }}</td>
                    <td class="text-end">{{ (order.netAmount || order.totalAmount) | number:'1.2-2' }}</td>
                    <td class="text-end">{{ order.vatAmount ? (order.vatAmount | number:'1.2-2') : '-' }}</td>
                    <td class="text-end">{{ order.tip ? (order.tip | number:'1.2-2') : '-' }}</td>
                    <td class="text-end fw-semibold">{{ getOrderTotal(order) | number:'1.2-2' }}</td>
                  </tr>
                }
              }
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="7" class="text-end fw-semibold">{{ 'REPORTS.REVENUE.TOTALS' | translate }}:</td>
                <td class="text-end fw-bold">{{ calculateNetTotal() | number:'1.2-2' }}</td>
                <td class="text-end fw-bold">{{ calculateVatTotal() | number:'1.2-2' }}</td>
                <td class="text-end fw-bold">{{ calculateTipTotal() | number:'1.2-2' }}</td>
                <td class="text-end fw-bold">{{ calculateGrandTotal() | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div class="card-footer">
        @if (totalPages >= 1) {
          <ul class="pagination-list">
            <li>
              <a href="javascript:void(0);" (click)="loadPage(currentPage - 1)" [class.disabled]="currentPage === 0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </a>
            </li>
            @for (page of getPageNumbers(); track page) {
              <li>
                <a href="javascript:void(0);" [class.active]="page === currentPage" (click)="loadPage(page)">
                  {{ page + 1 }}
                </a>
              </li>
            }
            <li>
              <a href="javascript:void(0);" (click)="loadPage(currentPage + 1)" [class.disabled]="currentPage >= totalPages - 1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </li>
          </ul>
        }
        <div class="page-size-wrapper">
          <select class="page-size-select" [(ngModel)]="pageSize" (change)="onPageSizeChange()">
            <option [value]="10">10</option>
            <option [value]="50">50</option>
            <option [value]="100">100</option>
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--white); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--border-color); }
    .card-title { font-size: 15px; font-weight: 600; margin: 0; color: var(--text-dark); }
    .card-body.p-0 { padding: 0 !important; }
    .card-footer { padding: 10px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: center; align-items: center; position: relative; }

    .table-responsive { overflow-x: auto; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .table thead th { padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); background: var(--bg-light); border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    .table tbody td { padding: 10px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; font-size: 13px; }
    .table tbody tr:last-child td { border-bottom: none; }
    .table tfoot td { padding: 12px 16px; background: var(--bg-light); border-top: 1px solid var(--border-color); }

    .fw-semibold { font-weight: 600; color: var(--text-dark); }
    .fw-bold { font-weight: 700; color: var(--text-dark); }
    .text-muted { color: var(--text-muted) !important; font-size: 13px; }
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .py-4 { padding-top: 20px !important; padding-bottom: 20px !important; }
    .mb-0 { margin-bottom: 0; }
    .d-flex { display: flex; }
    .align-items-center { align-items: center; }

    .paid-badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .paid-badge.paid { background: rgba(76, 175, 80, 0.1); color: #388E3C; }
    .paid-badge.unpaid { background: rgba(255, 152, 0, 0.1); color: #F57C00; }

    .payment-method-badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .payment-method-badge.cash { background: rgba(76, 175, 80, 0.15); color: #2E7D32; }
    .payment-method-badge.card { background: rgba(33, 150, 243, 0.15); color: #1565C0; }
    .payment-method-badge.online { background: rgba(156, 39, 176, 0.15); color: #7B1FA2; }

    .pagination-list { list-style: none; display: flex; align-items: center; gap: 4px; margin: 0; padding: 0; }
    .pagination-list li a { display: flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; padding: 0 8px; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-muted); text-decoration: none; background: var(--bg-light); transition: all 0.15s ease; }
    .pagination-list li a:hover:not(.disabled) { background: var(--primary-light); color: var(--primary); }
    .pagination-list li a.active { background: var(--primary); color: white; }
    .pagination-list li a.disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination-list li a svg { width: 12px; height: 12px; }

    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header-left { display: flex; align-items: center; gap: 16px; }
    .page-header-title h5 { margin: 0; font-size: 20px; font-weight: 600; color: var(--text-dark); }
    .breadcrumb { display: flex; list-style: none; padding: 0; margin: 0; gap: 8px; font-size: 13px; }
    .breadcrumb-item { color: var(--text-muted); }
    .breadcrumb-item a { color: var(--primary); text-decoration: none; }
    .breadcrumb-item + .breadcrumb-item::before { content: '/'; margin-right: 8px; color: var(--text-muted); }

    .total-row td { font-size: 14px; }

    /* Filter Styles */
    .filter-section { display: flex; align-items: center; gap: 16px; }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-label { font-size: 13px; font-weight: 500; color: var(--text-muted); }

    /* Pagination Wrapper */
    .page-size-wrapper { position: absolute; right: 20px; }
    .page-size-select { height: 28px; padding: 0 8px; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-muted); background: var(--bg-light); cursor: pointer; transition: all 0.15s ease; }
    .page-size-select:hover { background: var(--primary-light); color: var(--primary); }
    .page-size-select:focus { outline: none; background: var(--primary-light); color: var(--primary); }

    /* Date picker styles */
    .date-field { width: 140px; }
    .date-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    .date-field .mdc-text-field--outlined { height: 36px !important; background: transparent !important; border-radius: 8px !important; }
    .date-field .mat-mdc-form-field-flex { height: 36px !important; align-items: center !important; }
    .date-field .mdc-notched-outline__leading { border-radius: 8px 0 0 8px !important; border-color: var(--border-color) !important; }
    .date-field .mdc-notched-outline__notch { border-color: var(--border-color) !important; }
    .date-field .mdc-notched-outline__trailing { border-radius: 0 8px 8px 0 !important; border-color: var(--border-color) !important; }
    .date-field .mat-mdc-form-field-infix { padding-top: 8px !important; padding-bottom: 8px !important; padding-left: 10px !important; min-height: unset !important; width: auto !important; }
    .date-field input.mat-mdc-input-element { font-size: 13px !important; font-weight: 500 !important; color: var(--text-dark) !important; }
    .date-field .mat-mdc-form-field-icon-suffix { padding-right: 4px !important; }
    .date-field .mat-datepicker-toggle { width: 28px !important; height: 28px !important; }
    .date-field .mat-datepicker-toggle button { width: 28px !important; height: 28px !important; padding: 2px !important; }
    .date-field .mat-datepicker-toggle svg { width: 18px !important; height: 18px !important; fill: var(--text-muted) !important; }

    /* Datepicker popup styles */
    .mat-datepicker-content { background: var(--white) !important; box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important; border-radius: 8px !important; }
    .mat-calendar { background: var(--white) !important; }
    .mat-calendar-body-cell-content { color: var(--text-dark) !important; }
    .mat-calendar-body-selected { background: var(--primary) !important; color: white !important; }
    .mat-calendar-body-today:not(.mat-calendar-body-selected) { border-color: var(--primary) !important; }
    .mat-calendar-table-header { background: var(--white) !important; }
    .mat-calendar-table-header th { color: var(--text-muted) !important; background: var(--white) !important; }
    .mat-calendar-table-header-divider { display: none !important; }
    .mat-calendar-arrow { fill: var(--text-dark) !important; }
    .mat-calendar-previous-button, .mat-calendar-next-button { color: var(--text-dark) !important; }
    .mat-calendar-period-button { color: var(--text-dark) !important; }

    /* Filter Header Styles */
    .filter-header { position: relative; }
    .filter-header-content { display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; }
    .filter-header-content:hover { color: var(--primary); }
    .filter-icon { width: 14px; height: 14px; color: var(--text-muted); transition: color 0.15s; }
    .filter-icon.active { color: var(--primary); }
    .filter-header-content:hover .filter-icon { color: var(--primary); }

    .filter-dropdown { position: absolute; top: 100%; left: 0; min-width: 180px; background: var(--white); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; margin-top: 4px; }
    .filter-actions { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-color); }
    .filter-action-btn { background: none; border: none; padding: 4px 8px; font-size: 11px; font-weight: 500; color: var(--primary); cursor: pointer; border-radius: 4px; }
    .filter-action-btn:hover { background: var(--primary-light); }
    .filter-options { padding: 8px 0; max-height: 200px; overflow-y: auto; }
    .filter-option { display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px; font-weight: 400; color: var(--text-dark); }
    .filter-option:hover { background: var(--bg-light); }
    .filter-option input[type="checkbox"] { width: 14px; height: 14px; margin: 0; cursor: pointer; accent-color: var(--primary); }
    .filter-option span { white-space: nowrap; }
  `],
  encapsulation: ViewEncapsulation.None
})
export class RevenueComponent implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = false;
  currentPage = 0;
  totalPages = 0;
  pageSize = 10;
  startDate: Date | null = null;
  endDate: Date | null = null;

  // Multi-select filters
  availablePaymentMethods: string[] = [];
  availableOperators: string[] = [];
  availableStatuses: string[] = [];

  selectedPaymentMethods: Set<string> = new Set();
  selectedOperators: Set<string> = new Set();
  selectedStatuses: Set<string> = new Set();

  showPaymentMethodFilter = false;
  showOperatorFilter = false;
  showStatusFilter = false;

  constructor(private orderService: OrderService) {
    this.initDateFilters();
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  initDateFilters(): void {
    const today = new Date();
    this.startDate = today;
    this.endDate = today;
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadOrders();
  }

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize);
    this.currentPage = 0;
    this.loadOrders();
  }

  private formatDateForApi(date: Date | null, endOfDay: boolean = false): string | undefined {
    if (!date) return undefined;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return endOfDay ? dateStr + 'T23:59:59' : dateStr + 'T00:00:00';
  }

  loadOrders(): void {
    this.loading = true;
    const startDateParam = this.formatDateForApi(this.startDate, false);
    const endDateParam = this.formatDateForApi(this.endDate, true);
    this.orderService.getOrders(this.currentPage, this.pageSize, startDateParam, endDateParam).subscribe({
      next: (response: PageResponse<Order>) => {
        this.orders = response.content;
        this.totalPages = response.totalPages;
        this.extractFilterOptions();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.loading = false;
      }
    });
  }

  extractFilterOptions(): void {
    const paymentMethods = new Set<string>();
    const operators = new Set<string>();
    const statuses = new Set<string>();

    this.orders.forEach(order => {
      if (order.paymentMethod) paymentMethods.add(order.paymentMethod);
      if (order.paidBy) operators.add(order.paidBy);
      statuses.add(order.needsPayment ? 'UNPAID' : 'PAID');
    });

    this.availablePaymentMethods = Array.from(paymentMethods).sort();
    this.availableOperators = Array.from(operators).sort();
    this.availableStatuses = Array.from(statuses).sort();
  }

  applyFilters(): void {
    this.filteredOrders = this.orders.filter(order => {
      // Payment method filter
      if (this.selectedPaymentMethods.size > 0 && order.paymentMethod) {
        if (!this.selectedPaymentMethods.has(order.paymentMethod)) return false;
      } else if (this.selectedPaymentMethods.size > 0 && !order.paymentMethod) {
        return false;
      }

      // Operator filter
      if (this.selectedOperators.size > 0) {
        if (!order.paidBy || !this.selectedOperators.has(order.paidBy)) return false;
      }

      // Status filter
      if (this.selectedStatuses.size > 0) {
        const status = order.needsPayment ? 'UNPAID' : 'PAID';
        if (!this.selectedStatuses.has(status)) return false;
      }

      return true;
    });
  }

  togglePaymentMethodFilter(event: Event): void {
    event.stopPropagation();
    this.showPaymentMethodFilter = !this.showPaymentMethodFilter;
    this.showOperatorFilter = false;
    this.showStatusFilter = false;
  }

  toggleOperatorFilter(event: Event): void {
    event.stopPropagation();
    this.showOperatorFilter = !this.showOperatorFilter;
    this.showPaymentMethodFilter = false;
    this.showStatusFilter = false;
  }

  toggleStatusFilter(event: Event): void {
    event.stopPropagation();
    this.showStatusFilter = !this.showStatusFilter;
    this.showPaymentMethodFilter = false;
    this.showOperatorFilter = false;
  }

  closeAllFilters(): void {
    this.showPaymentMethodFilter = false;
    this.showOperatorFilter = false;
    this.showStatusFilter = false;
  }

  togglePaymentMethod(method: string): void {
    if (this.selectedPaymentMethods.has(method)) {
      this.selectedPaymentMethods.delete(method);
    } else {
      this.selectedPaymentMethods.add(method);
    }
    this.applyFilters();
  }

  toggleOperator(operator: string): void {
    if (this.selectedOperators.has(operator)) {
      this.selectedOperators.delete(operator);
    } else {
      this.selectedOperators.add(operator);
    }
    this.applyFilters();
  }

  toggleStatus(status: string): void {
    if (this.selectedStatuses.has(status)) {
      this.selectedStatuses.delete(status);
    } else {
      this.selectedStatuses.add(status);
    }
    this.applyFilters();
  }

  clearPaymentMethodFilter(): void {
    this.selectedPaymentMethods.clear();
    this.applyFilters();
  }

  clearOperatorFilter(): void {
    this.selectedOperators.clear();
    this.applyFilters();
  }

  clearStatusFilter(): void {
    this.selectedStatuses.clear();
    this.applyFilters();
  }

  selectAllPaymentMethods(): void {
    this.availablePaymentMethods.forEach(m => this.selectedPaymentMethods.add(m));
    this.applyFilters();
  }

  selectAllOperators(): void {
    this.availableOperators.forEach(o => this.selectedOperators.add(o));
    this.applyFilters();
  }

  selectAllStatuses(): void {
    this.availableStatuses.forEach(s => this.selectedStatuses.add(s));
    this.applyFilters();
  }

  loadPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    this.loadOrders();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);
    if (end - start < maxVisible) { start = Math.max(0, end - maxVisible); }
    for (let i = start; i < end; i++) { pages.push(i); }
    return pages;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'CASH': return 'Cash';
      case 'CARD': return 'Card';
      case 'ONLINE': return 'Online';
      default: return method;
    }
  }

  getOrderTotal(order: Order): number {
    return (order.totalAmount || 0) + (order.tip || 0);
  }

  calculateNetTotal(): number {
    return this.filteredOrders.reduce((sum, order) => sum + (order.netAmount || order.totalAmount || 0), 0);
  }

  calculateVatTotal(): number {
    return this.filteredOrders.reduce((sum, order) => sum + (order.vatAmount || 0), 0);
  }

  calculateTipTotal(): number {
    return this.filteredOrders.reduce((sum, order) => sum + (order.tip || 0), 0);
  }

  calculateGrandTotal(): number {
    return this.filteredOrders.reduce((sum, order) => sum + this.getOrderTotal(order), 0);
  }

  getStatusLabel(status: string): string {
    return status === 'PAID' ? 'Paid' : 'Unpaid';
  }
}
