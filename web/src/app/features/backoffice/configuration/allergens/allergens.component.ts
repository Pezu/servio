import { Component, OnInit, OnDestroy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AllergenService, Allergen, PageResponse } from './allergen.service';
import {
  PaginationComponent,
  ModalComponent,
  ToggleSwitchComponent,
  APP_CONFIG
} from '../../../../shared';

@Component({
  selector: 'app-allergens',
  standalone: true,
  imports: [
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
                  <th>Number</th>
                  <th>Name</th>
                  <th>Active</th>
                  <th class="text-end">
                    <button class="btn-icon-action btn-icon-add" (click)="openModal()" title="Add Allergen">
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
                } @else if (allergens.length === 0) {
                  <tr><td colspan="4" class="text-center py-4 text-muted">No allergens found</td></tr>
                } @else {
                  @for (allergen of allergens; track allergen.id) {
                    <tr [class.inactive-row]="!allergen.active">
                      <td>
                        <span class="allergen-number">{{ allergen.number }}</span>
                      </td>
                      <td><span class="fw-semibold">{{ allergen.name }}</span></td>
                      <td>
                        <app-toggle-switch
                          [checked]="allergen.active ?? false"
                          (change)="toggleActive(allergen)">
                        </app-toggle-switch>
                      </td>
                      <td class="text-end">
                        <button class="btn-icon-action btn-icon-action-sm" (click)="editAllergen(allergen)" title="Edit Allergen">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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

    <!-- Allergen Modal -->
    <app-modal
      [isOpen]="showModal"
      [title]="editingAllergen ? 'Edit Allergen' : 'Add New Allergen'"
      [submitText]="editingAllergen ? 'Update' : 'Create'"
      [saving]="saving"
      [submitDisabled]="!formData.name.trim()"
      (close)="closeModal()"
      (submit)="saveAllergen()">
      <div class="form-group">
        <label for="allergenName">Name</label>
        <input type="text" id="allergenName" class="form-control" [(ngModel)]="formData.name" placeholder="Enter allergen name">
      </div>
    </app-modal>
  `,
  styles: [`
    .page-container { margin-bottom: 24px; }
    .card { background: var(--white); border-radius: 0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); overflow: hidden; }
    .card-body.p-0 { padding: 0 !important; }

    .table-responsive { overflow-x: auto; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .table thead th { padding: 12px 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); background: #fff; border-bottom: 1px solid var(--border-color); }
    .table tbody td { padding: 12px 20px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    .table tbody tr:last-child td { border-bottom: none; }
    .table-hover tbody tr { transition: background 0.15s ease; }
    .table-hover tbody tr:hover { background: var(--bg-light); }
    .table tbody tr.inactive-row { opacity: 0.5; }

    .allergen-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--primary-light); color: var(--primary); border-radius: 6px; font-size: 13px; font-weight: 600; }
    .fw-semibold { font-weight: 600; color: var(--text-dark); }
    .text-muted { color: var(--text-muted) !important; }
    .text-end { text-align: right; }
    .text-center { text-align: center; }
    .py-4 { padding-top: 24px !important; padding-bottom: 24px !important; }
    .mb-0 { margin-bottom: 0; }

    .btn-icon-action { width: 32px; height: 32px; border: 1px solid rgba(0, 0, 0, 0.08); background: transparent; border-radius: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #64748b; transition: all 0.15s ease; margin-left: 4px; }
    .btn-icon-action:hover { background: rgba(0, 0, 0, 0.04); color: #374151; }
    .btn-icon-action svg { width: 16px; height: 16px; }
    .btn-icon-action-sm { width: 34px; height: 34px; border-radius: 0; }
    .btn-icon-action-sm svg { width: 17px; height: 17px; }
    .btn-icon-add { background: transparent; border-color: rgba(0, 0, 0, 0.08); color: #64748b; border-radius: 0; }
    .btn-icon-add:hover { background: rgba(0, 0, 0, 0.04); border-color: rgba(0, 0, 0, 0.08); color: #374151; }

    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: var(--text-dark); }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 0; font-size: 14px; color: var(--text-dark); transition: all 0.15s ease; box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .form-control::placeholder { color: var(--text-muted); }
  `]
})
export class AllergensComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  allergens: Allergen[] = [];
  loading = true;
  saving = false;

  showModal = false;
  editingAllergen: Allergen | null = null;
  formData: Allergen = { name: '' };

  currentPage = 0;
  totalPages = 0;
  totalItems = 0;
  pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE;

  constructor(private allergenService: AllergenService) {}

  ngOnInit(): void {
    this.loadAllergens();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllergens(): void {
    this.loading = true;
    this.allergenService.getAllergens(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PageResponse<Allergen>) => {
          this.allergens = response.content;
          this.totalPages = response.totalPages;
          this.totalItems = response.totalElements;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading allergens:', err);
          this.loading = false;
        }
      });
  }

  loadPage(page: number): void {
    this.currentPage = page;
    this.loadAllergens();
  }

  openModal(): void {
    this.editingAllergen = null;
    this.formData = { name: '' };
    this.showModal = true;
  }

  editAllergen(allergen: Allergen): void {
    this.editingAllergen = allergen;
    this.formData = { name: allergen.name };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingAllergen = null;
  }

  saveAllergen(): void {
    if (!this.formData.name.trim()) return;
    this.saving = true;

    const operation = this.editingAllergen
      ? this.allergenService.updateAllergen(this.editingAllergen.id!, this.formData)
      : this.allergenService.createAllergen(this.formData);

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeModal();
        this.loadAllergens();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error saving allergen:', err);
        this.saving = false;
      }
    });
  }

  toggleActive(allergen: Allergen): void {
    if (!allergen.id) return;
    this.allergenService.toggleActive(allergen.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedAllergen) => {
          const index = this.allergens.findIndex(a => a.id === allergen.id);
          if (index !== -1) {
            this.allergens[index] = updatedAllergen;
          }
        },
        error: (err) => {
          console.error('Error toggling active status:', err);
        }
      });
  }
}
