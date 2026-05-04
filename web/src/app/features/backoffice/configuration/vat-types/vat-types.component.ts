import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { VatTypeService, VatType, PageResponse } from './vat-type.service';
import {
  PaginationComponent,
  ModalComponent,
  ToggleSwitchComponent,
  APP_CONFIG
} from '../../../../shared';

@Component({
  selector: 'app-vat-types',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PaginationComponent,
    ModalComponent,
    ToggleSwitchComponent
  ],
  template: `
    <div class="page-container">
      <div class="card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>VAT Type Name</th>
                  <th>Value (%)</th>
                  <th>Active</th>
                  <th class="text-end">
                    <button class="btn-icon-action btn-icon-add" (click)="openModal()" title="Add VAT Type">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                @if (loading) {
                  <tr><td colspan="4" class="text-center py-4 text-muted">Loading...</td></tr>
                } @else if (vatTypes.length === 0) {
                  <tr><td colspan="4" class="text-center py-4 text-muted">No VAT types found</td></tr>
                } @else {
                  @for (vatType of vatTypes; track vatType.id) {
                    <tr [class.inactive-row]="!vatType.active">
                      <td><span class="fw-semibold">{{ vatType.name }}</span></td>
                      <td class="text-muted">{{ vatType.value }}%</td>
                      <td>
                        <app-toggle-switch
                          [checked]="vatType.active ?? false"
                          (change)="toggleActive(vatType)">
                        </app-toggle-switch>
                      </td>
                      <td class="text-end">
                        <button class="btn-icon-action btn-icon-action-sm" (click)="editVatType(vatType)" title="Edit VAT Type">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
        <app-pagination
          [currentPage]="currentPage"
          [totalPages]="totalPages"
          [totalItems]="totalItems"
          [pageSize]="pageSize"
          [showInfo]="false"
          (pageChange)="loadPage($event)">
        </app-pagination>
      </div>
    </div>

    <!-- VAT Type Modal -->
    <app-modal
      [isOpen]="showModal"
      [title]="editingVatType ? 'Edit VAT Type' : 'Add New VAT Type'"
      [submitText]="editingVatType ? 'Update' : 'Create'"
      [saving]="saving"
      [submitDisabled]="!formData.name.trim() || formData.value === null"
      (close)="closeModal()"
      (submit)="saveVatType()">
      <div class="form-group">
        <label for="vatTypeName">VAT Type Name</label>
        <input type="text" id="vatTypeName" class="form-control" [(ngModel)]="formData.name" placeholder="Enter VAT type name">
      </div>
      <div class="form-group">
        <label for="vatTypeValue">Value (%)</label>
        <input type="number" id="vatTypeValue" class="form-control" [(ngModel)]="formData.value" placeholder="Enter VAT percentage" step="0.01" min="0" max="100">
      </div>
    </app-modal>
  `,
  styles: [`
    .page-container { margin-bottom: 24px; }
    .card { background: var(--white); border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); overflow: hidden; }
    .card-body.p-0 { padding: 0 !important; }

    .table-responsive { overflow-x: auto; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .table thead th { padding: 12px 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); background: #fff; border-bottom: 1px solid var(--border-color); }
    .table tbody td { padding: 12px 20px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    .table tbody tr:last-child td { border-bottom: none; }
    .table-hover tbody tr { transition: background 0.15s ease; }
    .table-hover tbody tr:hover { background: var(--bg-light); }
    .table tbody tr.inactive-row { opacity: 0.5; }

    .fw-semibold { font-weight: 600; color: var(--text-dark); }
    .text-muted { color: var(--text-muted) !important; }
    .text-end { text-align: right; }
    .text-center { text-align: center; }
    .py-4 { padding-top: 24px !important; padding-bottom: 24px !important; }
    .mb-0 { margin-bottom: 0; }

    .btn-icon-action { width: 32px; height: 32px; border: none; background: var(--bg-light); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--text-muted); transition: all 0.15s ease; margin-left: 4px; }
    .btn-icon-action:hover { background: var(--primary-light); color: var(--primary); }
    .btn-icon-action svg { width: 16px; height: 16px; }
    .btn-icon-action-sm { width: 28px; height: 28px; }
    .btn-icon-action-sm svg { width: 14px; height: 14px; }
    .btn-icon-add:hover { background: var(--primary-light); color: var(--primary); }

    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: var(--text-dark); }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-dark); transition: all 0.15s ease; box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .form-control::placeholder { color: var(--text-muted); }
  `]
})
export class VatTypesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  vatTypes: VatType[] = [];
  loading = true;
  saving = false;

  showModal = false;
  editingVatType: VatType | null = null;
  formData: VatType = { name: '', value: 0 };

  currentPage = 0;
  totalPages = 0;
  totalItems = 0;
  pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE;

  constructor(private vatTypeService: VatTypeService) {}

  ngOnInit(): void {
    this.loadVatTypes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadVatTypes(): void {
    this.loading = true;
    this.vatTypeService.getVatTypes(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PageResponse<VatType>) => {
          this.vatTypes = response.content;
          this.totalPages = response.totalPages;
          this.totalItems = response.totalElements;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading VAT types:', err);
          this.loading = false;
        }
      });
  }

  loadPage(page: number): void {
    this.currentPage = page;
    this.loadVatTypes();
  }

  openModal(): void {
    this.editingVatType = null;
    this.formData = { name: '', value: 0 };
    this.showModal = true;
  }

  editVatType(vatType: VatType): void {
    this.editingVatType = vatType;
    this.formData = { name: vatType.name, value: vatType.value };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingVatType = null;
  }

  saveVatType(): void {
    if (!this.formData.name.trim() || this.formData.value === null) return;
    this.saving = true;

    const operation = this.editingVatType
      ? this.vatTypeService.updateVatType(this.editingVatType.id!, this.formData)
      : this.vatTypeService.createVatType(this.formData);

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeModal();
        this.loadVatTypes();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error saving VAT type:', err);
        this.saving = false;
      }
    });
  }

  toggleActive(vatType: VatType): void {
    if (!vatType.id) return;
    this.vatTypeService.toggleActive(vatType.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedVatType) => {
          const index = this.vatTypes.findIndex(v => v.id === vatType.id);
          if (index !== -1) {
            this.vatTypes[index] = updatedVatType;
          }
        },
        error: (err) => {
          console.error('Error toggling active status:', err);
        }
      });
  }
}