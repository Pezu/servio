import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { RoleService, Role, PageResponse } from './role.service';
import {
  PaginationComponent,
  ModalComponent,
  ToggleSwitchComponent,
  APP_CONFIG
} from '../../../../shared';

@Component({
  selector: 'app-roles',
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
                  <th>Role Name</th>
                  <th>Description</th>
                  <th>Active</th>
                  <th class="text-end">
                    <button class="btn-icon-action btn-icon-add" (click)="openModal()" title="Add Role">
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
                } @else if (roles.length === 0) {
                  <tr><td colspan="4" class="text-center py-4 text-muted">No roles found</td></tr>
                } @else {
                  @for (role of roles; track role.id) {
                    <tr [class.inactive-row]="!role.active">
                      <td><span class="fw-semibold">{{ role.name }}</span></td>
                      <td class="text-muted">{{ role.description || '-' }}</td>
                      <td>
                        <app-toggle-switch
                          [checked]="role.active ?? false"
                          (change)="toggleActive(role)">
                        </app-toggle-switch>
                      </td>
                      <td class="text-end">
                        <button class="btn-icon-action btn-icon-action-sm" (click)="editRole(role)" title="Edit Role">
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

    <!-- Role Modal -->
    <app-modal
      [isOpen]="showModal"
      [title]="editingRole ? 'Edit Role' : 'Add New Role'"
      [submitText]="editingRole ? 'Update' : 'Create'"
      [saving]="saving"
      [submitDisabled]="!formData.name.trim()"
      (close)="closeModal()"
      (submit)="saveRole()">
      <div class="form-group">
        <label for="roleName">Role Name</label>
        <input type="text" id="roleName" class="form-control" [(ngModel)]="formData.name" placeholder="Enter role name">
      </div>
      <div class="form-group">
        <label for="roleDescription">Description</label>
        <textarea id="roleDescription" class="form-control" [(ngModel)]="formData.description" placeholder="Enter description (optional)" rows="3"></textarea>
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
    textarea.form-control { resize: vertical; min-height: 80px; }
  `]
})
export class RolesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  roles: Role[] = [];
  loading = true;
  saving = false;

  showModal = false;
  editingRole: Role | null = null;
  formData: Role = { name: '', description: '' };

  currentPage = 0;
  totalPages = 0;
  totalItems = 0;
  pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE;

  constructor(private roleService: RoleService) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRoles(): void {
    this.loading = true;
    this.roleService.getRoles(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PageResponse<Role>) => {
          this.roles = response.content;
          this.totalPages = response.totalPages;
          this.totalItems = response.totalElements;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading roles:', err);
          this.loading = false;
        }
      });
  }

  loadPage(page: number): void {
    this.currentPage = page;
    this.loadRoles();
  }

  openModal(): void {
    this.editingRole = null;
    this.formData = { name: '', description: '' };
    this.showModal = true;
  }

  editRole(role: Role): void {
    this.editingRole = role;
    this.formData = { name: role.name, description: role.description || '' };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingRole = null;
  }

  saveRole(): void {
    if (!this.formData.name.trim()) return;
    this.saving = true;

    const operation = this.editingRole
      ? this.roleService.updateRole(this.editingRole.id!, this.formData)
      : this.roleService.createRole(this.formData);

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeModal();
        this.loadRoles();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error saving role:', err);
        this.saving = false;
      }
    });
  }

  toggleActive(role: Role): void {
    if (!role.id) return;
    this.roleService.toggleActive(role.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedRole) => {
          const index = this.roles.findIndex(r => r.id === role.id);
          if (index !== -1) {
            this.roles[index] = updatedRole;
          }
        },
        error: (err) => {
          console.error('Error toggling active status:', err);
        }
      });
  }
}
