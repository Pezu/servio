import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { OrderService, Order, PageResponse } from './order.service';

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
  selector: 'app-orders',
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
          <h5>{{ 'ORDERS.TITLE' | translate }}</h5>
        </div>
        <ul class="breadcrumb">
          <li class="breadcrumb-item"><a href="/">Home</a></li>
          <li class="breadcrumb-item">{{ 'ORDERS.TITLE' | translate }}</li>
        </ul>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="card">
      <div class="card-header">
        <h5 class="card-title">{{ 'ORDERS.ALL_ORDERS' | translate }}</h5>
        <div class="filter-section">
          <div class="filter-group">
            <label class="filter-label">{{ 'ORDERS.FROM' | translate }}</label>
            <mat-form-field class="date-field" appearance="outline">
              <input matInput [matDatepicker]="startPicker" [(ngModel)]="startDate" (dateChange)="onFilterChange()" placeholder="Select date">
              <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>
          </div>
          <div class="filter-group">
            <label class="filter-label">{{ 'ORDERS.TO' | translate }}</label>
            <mat-form-field class="date-field" appearance="outline">
              <input matInput [matDatepicker]="endPicker" [(ngModel)]="endDate" (dateChange)="onFilterChange()" placeholder="Select date">
              <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
            </mat-form-field>
          </div>
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>{{ 'ORDERS.ORDER_NO' | translate }}</th>
                <th>{{ 'ORDERS.EVENT' | translate }}</th>
                <th>{{ 'ORDERS.STATUS' | translate }}</th>
                <th>{{ 'ORDERS.ASSIGNED_TO' | translate }}</th>
                <th>{{ 'ORDERS.ORDER_DATE' | translate }}</th>
                <th>{{ 'ORDERS.TOTAL' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr><td colspan="6" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
              } @else if (orders.length === 0) {
                <tr><td colspan="6" class="text-center py-4 text-muted">{{ 'ORDERS.NO_ORDERS' | translate }}</td></tr>
              } @else {
                @for (order of orders; track order.id) {
                  <tr (click)="openOrderDetails(order)">
                    <td class="position-relative">
                      <div class="status-indicator" [class]="getStatusIndicatorClass(order.status)"></div>
                      <span class="fw-semibold">#{{ order.orderNo }}</span>
                    </td>
                    <td class="text-muted">{{ order.eventName || '-' }}</td>
                    <td>
                      <span class="status-badge" [class]="getStatusBadgeClass(order.status)">
                        {{ getStatusLabelKey(order.status) | translate }}
                      </span>
                    </td>
                    <td class="text-muted">{{ order.assignedUser || '-' }}</td>
                    <td class="text-muted">{{ formatDate(order.createdAt) }}</td>
                    <td class="text-muted">{{ calculateTotal(order) | number:'1.2-2' }}</td>
                  </tr>
                }
              }
            </tbody>
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

    <!-- Order Details Modal -->
    @if (showModal && selectedOrder) {
      <div class="modal-overlay" (mousedown)="closeModal()">
        <div class="modal modal-lg" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ 'ORDERS.ORDER' | translate }} #{{ selectedOrder.orderNo }}</h3>
            <button class="close-btn" (click)="closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="order-info">
              <div class="info-row">
                <span class="info-label">{{ 'ORDERS.STATUS' | translate }}</span>
                <span class="status-badge" [class]="getStatusBadgeClass(selectedOrder.status)">
                  {{ getStatusLabelKey(selectedOrder.status) | translate }}
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">{{ 'ORDERS.ASSIGNED_TO' | translate }}</span>
                <span class="info-value">{{ selectedOrder.assignedUser || ('ORDERS.NOT_ASSIGNED' | translate) }}</span>
              </div>
              @if (selectedOrder.note) {
                <div class="info-row">
                  <span class="info-label">{{ 'ORDERS.NOTE' | translate }}</span>
                  <span class="info-value">{{ selectedOrder.note }}</span>
                </div>
              }
            </div>

            <h4 class="items-title">{{ 'ORDERS.ITEMS' | translate }}</h4>
            <div class="items-table">
              <table class="table mb-0">
                <thead>
                  <tr>
                    <th>{{ 'ORDERS.ITEM' | translate }}</th>
                    <th>{{ 'ORDERS.QTY' | translate }}</th>
                    <th>{{ 'ORDERS.PRICE' | translate }}</th>
                    <th>{{ 'ORDERS.STATUS' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of selectedOrder.items; track item.id) {
                    <tr>
                      <td>
                        <span class="fw-semibold">{{ item.name }}</span>
                        @if (item.note) {
                          <div class="item-note">{{ item.note }}</div>
                        }
                      </td>
                      <td>{{ item.quantity }}</td>
                      <td>{{ item.price | number:'1.2-2' }}</td>
                      <td>
                        <span class="item-status-badge" [class]="getItemStatusClass(item.status)">
                          {{ getItemStatusLabelKey(item.status) | translate }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">{{ 'COMMON.CLOSE' | translate }}</button>
          </div>
        </div>
      </div>
    }
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
    .table-hover tbody tr { cursor: pointer; transition: all 0.15s ease; }
    .table-hover tbody tr:hover { background: rgba(var(--primary-rgb, 59, 130, 246), 0.04); }

    .position-relative { position: relative; }
    .status-indicator { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 28px; border-radius: 0 3px 3px 0; }
    .status-indicator.status-active { background: #2196F3; }
    .status-indicator.status-in_progress { background: #FF9800; }
    .status-indicator.status-ready { background: #4CAF50; }
    .status-indicator.status-delivered { background: #9C27B0; }
    .status-indicator.status-cancelled { background: #f44336; }

    .fw-semibold { font-weight: 600; color: var(--text-dark); }
    .text-muted { color: var(--text-muted) !important; font-size: 13px; }
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .py-4 { padding-top: 20px !important; padding-bottom: 20px !important; }
    .mb-0 { margin-bottom: 0; }
    .d-flex { display: flex; }
    .align-items-center { align-items: center; }

    .status-badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .status-badge.status-active { background: rgba(33, 150, 243, 0.1); color: #1976D2; }
    .status-badge.status-in_progress { background: rgba(255, 152, 0, 0.1); color: #F57C00; }
    .status-badge.status-ready { background: rgba(76, 175, 80, 0.1); color: #388E3C; }
    .status-badge.status-delivered { background: rgba(156, 39, 176, 0.1); color: #7B1FA2; }
    .status-badge.status-cancelled { background: rgba(244, 67, 54, 0.1); color: #D32F2F; }

    .pagination-list { list-style: none; display: flex; align-items: center; gap: 4px; margin: 0; padding: 0; }
    .pagination-list li a { display: flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; padding: 0 8px; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-muted); text-decoration: none; background: var(--bg-light); transition: all 0.15s ease; }
    .pagination-list li a:hover:not(.disabled) { background: var(--primary-light); color: var(--primary); }
    .pagination-list li a.active { background: var(--primary); color: white; }
    .pagination-list li a.disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination-list li a svg { width: 12px; height: 12px; }

    /* Modal Styles */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--white); border-radius: 12px; width: 100%; max-width: 500px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
    .modal.modal-lg { max-width: 700px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-dark); }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid var(--border-color); }
    .close-btn { width: 32px; height: 32px; border: none; background: var(--bg-light); border-radius: 6px; font-size: 20px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .close-btn:hover { background: var(--border-color); }

    .order-info { margin-bottom: 20px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color); }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 13px; color: var(--text-muted); font-weight: 500; }
    .info-value { font-size: 14px; color: var(--text-dark); }

    .items-title { font-size: 15px; font-weight: 600; color: var(--text-dark); margin: 0 0 12px 0; }
    .items-table { border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
    .items-table .table thead th { padding: 10px 16px; font-size: 11px; }
    .items-table .table tbody td { padding: 12px 16px; }
    .item-note { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    .item-status-badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .item-status-badge.status-ordered { background: rgba(33, 150, 243, 0.1); color: #1976D2; }
    .item-status-badge.status-in_progress { background: rgba(255, 152, 0, 0.1); color: #F57C00; }
    .item-status-badge.status-done { background: rgba(76, 175, 80, 0.1); color: #388E3C; }
    .item-status-badge.status-cancelled { background: rgba(244, 67, 54, 0.1); color: #D32F2F; }

    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
    .btn-secondary { background: var(--bg-light); color: var(--text-dark); }
    .btn-secondary:hover { background: var(--border-color); }

    /* Filter Styles */
    .filter-section { display: flex; align-items: center; gap: 16px; }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
    .filter-input { height: 36px; padding: 0 12px; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; font-family: inherit; color: var(--text-dark); background: var(--bg-light); transition: all 0.15s ease; }
    .filter-input:hover { background: var(--primary-light); }
    .filter-input:focus { outline: none; background: var(--white); box-shadow: 0 0 0 2px var(--primary-light), inset 0 0 0 1px var(--primary); }

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
  `],
  encapsulation: ViewEncapsulation.None
})
export class OrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  currentPage = 0;
  totalPages = 0;
  pageSize = 10;

  startDate: Date | null = null;
  endDate: Date | null = null;

  showModal = false;
  selectedOrder: Order | null = null;

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
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.loading = false;
      }
    });
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

  openOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedOrder = null;
  }

  getStatusLabelKey(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'ORDERS.STATUS_PENDING';
      case 'IN_PROGRESS': return 'ORDERS.STATUS_IN_PROGRESS';
      case 'READY': return 'ORDERS.STATUS_READY';
      case 'DELIVERED': return 'ORDERS.STATUS_DELIVERED';
      case 'CANCELLED': return 'ORDERS.STATUS_CANCELLED';
      default: return status;
    }
  }

  getStatusIndicatorClass(status: string): string {
    return 'status-' + status.toLowerCase();
  }

  getStatusBadgeClass(status: string): string {
    return 'status-' + status.toLowerCase();
  }

  getItemStatusLabelKey(status: string): string {
    switch (status) {
      case 'ORDERED': return 'ORDERS.ITEM_STATUS_ORDERED';
      case 'IN_PROGRESS': return 'ORDERS.ITEM_STATUS_PREPARING';
      case 'DONE': return 'ORDERS.ITEM_STATUS_READY';
      case 'CANCELLED': return 'ORDERS.ITEM_STATUS_CANCELLED';
      default: return status;
    }
  }

  getItemStatusClass(status: string): string {
    return 'status-' + status.toLowerCase();
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

  calculateTotal(order: Order): number {
    if (!order.items || order.items.length === 0) return 0;
    return order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
}