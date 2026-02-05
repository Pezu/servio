import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ClientTypeService, ClientType, PageResponse } from './client-type.service';

@Component({
  selector: 'app-client-types',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="page-container">
      <div class="card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>{{ 'CLIENT_TYPES.NAME' | translate }}</th>
                  <th>{{ 'CLIENT_TYPES.DESCRIPTION' | translate }}</th>
                  <th class="text-end">
                    <button class="btn-icon-action btn-icon-add" (click)="openModal()" [title]="'CLIENT_TYPES.ADD' | translate">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                @if (loading) {
                  <tr><td colspan="3" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                } @else if (clientTypes.length === 0) {
                  <tr><td colspan="3" class="text-center py-4 text-muted">{{ 'CLIENT_TYPES.NO_ITEMS' | translate }}</td></tr>
                } @else {
                  @for (clientType of clientTypes; track clientType.id) {
                    <tr>
                      <td>
                        <span class="fw-semibold">{{ clientType.name }}</span>
                      </td>
                      <td class="text-muted">{{ clientType.description || '-' }}</td>
                      <td class="text-end">
                        <button class="btn-icon-action btn-icon-action-sm" (click)="editClientType(clientType)" [title]="'COMMON.EDIT' | translate">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button class="btn-icon-action btn-icon-action-sm btn-icon-delete" (click)="confirmDelete(clientType)" [title]="'COMMON.DELETE' | translate">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        @if (totalPages > 1) {
          <div class="card-footer">
            <ul class="pagination-list">
              <li><a href="javascript:void(0);" (click)="loadPage(currentPage - 1)" [class.disabled]="currentPage === 0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
              </a></li>
              @for (page of getPageNumbers(); track page) {
                <li><a href="javascript:void(0);" [class.active]="page === currentPage" (click)="loadPage(page)">{{ page + 1 }}</a></li>
              }
              <li><a href="javascript:void(0);" (click)="loadPage(currentPage + 1)" [class.disabled]="currentPage >= totalPages - 1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
              </a></li>
            </ul>
          </div>
        }
      </div>
    </div>

    <!-- Client Type Modal -->
    @if (showModal) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingClientType ? ('CLIENT_TYPES.EDIT' | translate) : ('CLIENT_TYPES.ADD' | translate) }}</h3>
            <button class="close-btn" (click)="closeModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="clientTypeName">{{ 'CLIENT_TYPES.NAME' | translate }}</label>
              <input type="text" id="clientTypeName" class="form-control" [(ngModel)]="formData.name" [placeholder]="'CLIENT_TYPES.NAME' | translate">
            </div>
            <div class="form-group">
              <label for="clientTypeDescription">{{ 'CLIENT_TYPES.DESCRIPTION' | translate }}</label>
              <textarea id="clientTypeDescription" class="form-control" [(ngModel)]="formData.description" [placeholder]="'CLIENT_TYPES.DESCRIPTION' | translate" rows="3"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveClientType()" [disabled]="saving || !formData.name.trim()">
              {{ saving ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (showDeleteModal) {
      <div class="modal-overlay" (click)="closeDeleteModal()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ 'CLIENT_TYPES.DELETE' | translate }}</h3>
            <button class="close-btn" (click)="closeDeleteModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <p>{{ 'CLIENT_TYPES.DELETE_CONFIRM' | translate }} <strong>{{ clientTypeToDelete?.name }}</strong>?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeDeleteModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-danger" (click)="deleteClientType()" [disabled]="deleting">
              {{ deleting ? ('COMMON.DELETING' | translate) : ('COMMON.DELETE' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-container { margin-bottom: 24px; }
    .card { background: var(--white); border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); overflow: hidden; }
    .card-body.p-0 { padding: 0 !important; }
    .card-footer { padding: 12px 20px; border-top: 1px solid var(--border-color); background: var(--white); }

    .table-responsive { overflow-x: auto; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .table thead th { padding: 12px 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); background: #fff; border-bottom: 1px solid var(--border-color); }
    .table tbody td { padding: 12px 20px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    .table tbody tr:last-child td { border-bottom: none; }
    .table-hover tbody tr { transition: background 0.15s ease; }
    .table-hover tbody tr:hover { background: var(--bg-light); }

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
    .btn-icon-delete:hover { background: rgba(253, 84, 84, 0.1); color: var(--danger); }

    .pagination-list { list-style: none; display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0; padding: 0; }
    .pagination-list li a { display: flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 10px; border-radius: 6px; font-size: 13px; font-weight: 500; color: var(--text-muted); text-decoration: none; background: var(--bg-light); transition: all 0.15s ease; }
    .pagination-list li a:hover:not(.disabled) { background: var(--primary-light); color: var(--primary); }
    .pagination-list li a.active { background: var(--primary); color: white; }
    .pagination-list li a.disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination-list li a svg { width: 14px; height: 14px; }

    /* Modal Styles */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1050; }
    .modal { background: var(--white); border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2); }
    .modal-sm { max-width: 400px; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-dark); }
    .close-btn { width: 32px; height: 32px; border: none; background: var(--bg-light); border-radius: 6px; font-size: 20px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
    .close-btn:hover { background: rgba(253, 84, 84, 0.1); color: var(--danger); }
    .modal-body { padding: 20px; }
    .modal-body p { margin: 0; color: var(--text-dark); }
    .modal-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--border-color); }

    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: var(--text-dark); }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-dark); transition: all 0.15s ease; box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .form-control::placeholder { color: var(--text-muted); }
    textarea.form-control { resize: vertical; min-height: 80px; }

    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-secondary { background: var(--bg-light); color: var(--text-dark); }
    .btn-secondary:hover:not(:disabled) { background: var(--border-color); }
    .btn-danger { background: var(--danger); color: white; }
    .btn-danger:hover:not(:disabled) { background: #e04444; }
  `]
})
export class ClientTypesComponent implements OnInit {
  clientTypes: ClientType[] = [];
  loading = true;
  saving = false;
  deleting = false;

  showModal = false;
  editingClientType: ClientType | null = null;
  formData: ClientType = { name: '', description: '' };

  showDeleteModal = false;
  clientTypeToDelete: ClientType | null = null;

  currentPage = 0;
  totalPages = 0;
  pageSize = 10;

  constructor(private clientTypeService: ClientTypeService) {}

  ngOnInit(): void {
    this.loadClientTypes();
  }

  loadClientTypes(): void {
    this.loading = true;
    this.clientTypeService.getClientTypes(this.currentPage, this.pageSize).subscribe({
      next: (response: PageResponse<ClientType>) => {
        this.clientTypes = response.content;
        this.totalPages = response.totalPages;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading client types:', err);
        this.loading = false;
      }
    });
  }

  loadPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    this.loadClientTypes();
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

  openModal(): void {
    this.editingClientType = null;
    this.formData = { name: '', description: '' };
    this.showModal = true;
  }

  editClientType(clientType: ClientType): void {
    this.editingClientType = clientType;
    this.formData = { name: clientType.name, description: clientType.description || '' };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingClientType = null;
  }

  saveClientType(): void {
    if (!this.formData.name.trim()) return;
    this.saving = true;
    const operation = this.editingClientType
      ? this.clientTypeService.updateClientType(this.editingClientType.id!, this.formData)
      : this.clientTypeService.createClientType(this.formData);
    operation.subscribe({
      next: () => {
        this.closeModal();
        this.loadClientTypes();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error saving client type:', err);
        this.saving = false;
      }
    });
  }

  confirmDelete(clientType: ClientType): void {
    this.clientTypeToDelete = clientType;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.clientTypeToDelete = null;
  }

  deleteClientType(): void {
    if (!this.clientTypeToDelete?.id) return;
    this.deleting = true;
    this.clientTypeService.deleteClientType(this.clientTypeToDelete.id).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.loadClientTypes();
        this.deleting = false;
      },
      error: (err) => {
        console.error('Error deleting client type:', err);
        this.deleting = false;
      }
    });
  }
}