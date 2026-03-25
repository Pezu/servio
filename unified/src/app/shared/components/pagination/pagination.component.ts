import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_CONFIG } from '../../constants';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagination-container" *ngIf="totalPages > 1">
      <div class="pagination-info" *ngIf="showInfo">
        Showing {{ startItem }}-{{ endItem }} of {{ totalItems }}
      </div>
      <div class="pagination-controls">
        <button
          class="page-btn"
          [disabled]="currentPage === 0"
          (click)="onPageChange(currentPage - 1)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </button>

        <button
          *ngFor="let page of visiblePages"
          class="page-btn page-number"
          [class.active]="page === currentPage"
          (click)="onPageChange(page)">
          {{ page + 1 }}
        </button>

        <button
          class="page-btn"
          [disabled]="currentPage === totalPages - 1"
          (click)="onPageChange(currentPage + 1)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pagination-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-top: 1px solid var(--border-color, #e5e7eb);
      background: var(--card-bg, #fff);
    }
    .pagination-info {
      font-size: 13px;
      color: var(--text-secondary, #64748b);
    }
    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .page-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border: 1px solid var(--border-color, #e5e7eb);
      background: var(--card-bg, #fff);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #1e293b);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .page-btn:hover:not(:disabled) {
      background: var(--hover-bg, #f8fafc);
      border-color: var(--primary, #3b82f6);
    }
    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .page-btn.active {
      background: var(--primary, #3b82f6);
      border-color: var(--primary, #3b82f6);
      color: white;
    }
    .page-btn svg {
      width: 16px;
      height: 16px;
    }
  `]
})
export class PaginationComponent {
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Input() totalItems = 0;
  @Input() pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE;
  @Input() showInfo = true;
  @Output() pageChange = new EventEmitter<number>();

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = APP_CONFIG.PAGINATION.MAX_VISIBLE_PAGES;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);

    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  get startItem(): number {
    return this.currentPage * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalItems);
  }

  onPageChange(page: number): void {
    if (page >= 0 && page < this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }
}
