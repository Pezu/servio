import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ClientService, Client } from '../clients/client.service';
import { UserService, User } from '../clients/user.service';
import { RoleService, Role } from '../configuration/roles/role.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="page-container">
      <!-- Client Selector -->
      <div class="client-selector-container">
        <label class="selector-label">{{ 'CLIENTS.TITLE' | translate }}</label>
        <div class="selector-wrapper" [class.open]="dropdownOpen">
          <div class="selector-input" (click)="toggleDropdown()">
            <div class="selected-client" *ngIf="selectedClient">
              <span class="status-bullet" [class.bg-success]="selectedClient.status === 'ACTIVE'"
                    [class.bg-danger]="selectedClient.status === 'INACTIVE'"></span>
              <span class="client-name">{{ selectedClient.name }}</span>
              <span class="client-details" *ngIf="selectedClient.email || selectedClient.phone">
                ({{ selectedClient.email || selectedClient.phone }})
              </span>
            </div>
            <div class="placeholder" *ngIf="!selectedClient">
              {{ 'CLIENTS.SELECT_CLIENT' | translate }}
            </div>
            <span class="dropdown-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>

          <div class="selector-dropdown" *ngIf="dropdownOpen">
            <div class="search-box">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="search-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text"
                     class="search-input"
                     [placeholder]="'COMMON.SEARCH' | translate"
                     [(ngModel)]="searchTerm"
                     (input)="onSearch()"
                     (click)="$event.stopPropagation()">
            </div>

            <div class="client-list">
              <div *ngIf="loading" class="loading-state">
                {{ 'COMMON.LOADING' | translate }}
              </div>
              <div *ngIf="!loading && clients.length === 0" class="empty-state">
                {{ 'CLIENTS.NO_CLIENTS' | translate }}
              </div>
              <div *ngFor="let client of clients"
                   class="client-option"
                   [class.selected]="selectedClient?.id === client.id"
                   (click)="selectClient(client)">
                <span class="status-bullet" [class.bg-success]="client.status === 'ACTIVE'"
                      [class.bg-danger]="client.status === 'INACTIVE'"></span>
                <div class="client-info">
                  <span class="client-name">{{ client.name }}</span>
                  <span class="client-details">
                    <span *ngIf="client.email">{{ client.email }}</span>
                    <span *ngIf="client.email && client.phone"> · </span>
                    <span *ngIf="client.phone">{{ client.phone }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      @if (selectedClient) {
        <div class="users-panel">
          <div class="card stretch">
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>{{ 'USERS.USER' | translate }} <span class="text-muted fw-normal">- {{ selectedClient.name }}</span></th>
                      <th>{{ 'USERS.USERNAME' | translate }}</th>
                      <th>{{ 'USERS.ROLES' | translate }}</th>
                      <th class="text-end">
                        <button class="btn-icon-action btn-icon-add" (click)="openUserModal()" [title]="'USERS.ADD_USER' | translate">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @if (loadingUsers) {
                      <tr><td colspan="4" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                    } @else if (users.length === 0) {
                      <tr><td colspan="4" class="text-center py-4 text-muted">{{ 'USERS.NO_USERS' | translate }}</td></tr>
                    } @else {
                      @for (user of users; track user.id) {
                        <tr>
                          <td>
                            <div class="user-name-cell">
                              <svg class="user-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <a href="javascript:void(0);" class="fw-semibold">{{ user.name }}</a>
                            </div>
                          </td>
                          <td class="text-muted">{{ user.username }}</td>
                          <td>
                            <div class="role-badges">
                              @for (role of user.roles; track role) {
                                <span class="role-badge">{{ role }}</span>
                              }
                            </div>
                          </td>
                          <td class="text-end">
                            <button class="btn-icon-action btn-icon-action-sm" (click)="editUser(user)" [title]="'USERS.EDIT_USER' | translate">
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
            @if (userTotalPages > 1) {
              <div class="card-footer">
                <div class="pagination-container">
                  <ul class="pagination-list">
                    <li><a href="javascript:void(0);" (click)="loadUserPage(userCurrentPage - 1)" [class.disabled]="userCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
                    @for (page of getPageNumbers(userTotalPages, userCurrentPage); track page) {
                      <li><a href="javascript:void(0);" [class.active]="page === userCurrentPage" (click)="loadUserPage(page)">{{ page + 1 }}</a></li>
                    }
                    <li><a href="javascript:void(0);" (click)="loadUserPage(userCurrentPage + 1)" [class.disabled]="userCurrentPage >= userTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
                  </ul>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- User Modal -->
    @if (showUserModal) {
      <div class="modal-overlay" (mousedown)="closeUserModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingUser ? ('USERS.EDIT_USER' | translate) : ('USERS.ADD_USER' | translate) }}</h3>
            <button class="close-btn" (click)="closeUserModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="userName">{{ 'COMMON.NAME' | translate }}</label>
              <input type="text" id="userName" class="form-control" [(ngModel)]="userForm.name" [placeholder]="'USERS.ENTER_NAME' | translate">
            </div>
            <div class="form-group">
              <label for="userUsername">{{ 'USERS.USERNAME' | translate }}</label>
              <input type="text" id="userUsername" class="form-control" [(ngModel)]="userForm.username" [placeholder]="'USERS.ENTER_USERNAME' | translate">
            </div>
            <div class="form-group">
              <label for="userPassword">{{ 'USERS.PASSWORD' | translate }}</label>
              <input type="password" id="userPassword" class="form-control" [(ngModel)]="userForm.password" [placeholder]="editingUser ? ('USERS.LEAVE_BLANK' | translate) : ('USERS.ENTER_PASSWORD' | translate)">
            </div>
            <div class="form-group">
              <label>{{ 'USERS.ROLES' | translate }}</label>
              <div class="roles-select">
                @for (role of availableRoles; track role.id) {
                  <label class="role-checkbox">
                    <input type="checkbox" [checked]="userForm.roles.includes(role.name)" (change)="toggleRole(role.name)">
                    <span>{{ role.name }}</span>
                  </label>
                }
                @if (availableRoles.length === 0) {
                  <div class="text-muted">{{ 'COMMON.LOADING' | translate }}</div>
                }
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeUserModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveUser()" [disabled]="!userForm.name || !userForm.username || (!editingUser && !userForm.password) || savingUser">
              {{ savingUser ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      --primary: #3b82f6;
      --primary-light: #eff6ff;
      --success: #0caf60;
      --danger: #fd6a6a;
      --warning: #ffc107;
      --text-dark: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --bg-light: #f8fafc;
      --white: #ffffff;
      display: block;
      height: 100%;
    }

    /* Page Container - Full Height */
    .page-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    /* Client Selector Container */
    .client-selector-container {
      flex-shrink: 0;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Client Selector Styles */
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: visible;
    }
    .card-body {
      padding: 24px;
      overflow: visible;
    }
    .card-body.p-0 { padding: 0 !important; }
    .selector-label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      white-space: nowrap;
    }
    .selector-wrapper {
      position: relative;
      min-width: 360px;
    }
    .selector-input {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .selector-input:hover {
      border-color: #cbd5e1;
    }
    .selector-wrapper.open .selector-input {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .selected-client {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .placeholder {
      color: #94a3b8;
    }
    .dropdown-arrow {
      display: flex;
      align-items: center;
      color: #94a3b8;
      transition: transform 0.2s ease;
    }
    .dropdown-arrow svg {
      width: 18px;
      height: 18px;
    }
    .selector-wrapper.open .dropdown-arrow {
      transform: rotate(180deg);
    }
    .selector-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      z-index: 100;
      max-height: 350px;
      display: flex;
      flex-direction: column;
    }
    .search-box {
      display: flex;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      gap: 8px;
    }
    .search-icon {
      width: 18px;
      height: 18px;
      color: #94a3b8;
      flex-shrink: 0;
    }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 14px;
      color: #374151;
    }
    .search-input::placeholder {
      color: #94a3b8;
    }
    .client-list {
      overflow-y: auto;
      max-height: 280px;
    }
    .loading-state,
    .empty-state {
      padding: 20px;
      text-align: center;
      color: #94a3b8;
      font-size: 14px;
    }
    .client-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .client-option:hover {
      background: #f8fafc;
    }
    .client-option.selected {
      background: #eff6ff;
    }
    .client-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .client-name {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }
    .client-details {
      font-size: 12px;
      color: #64748b;
    }
    .status-bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .bg-success { background-color: var(--success); }
    .bg-danger { background-color: var(--danger); }

    /* Users Panel */
    .users-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .card.stretch {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .card-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--border-color);
      background: var(--white);
      flex-shrink: 0;
    }
    .card-body.p-0 {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* Table Styles */
    .table-responsive {
      overflow-x: auto;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }
    .table thead th {
      padding: 12px 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      background: var(--white);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .table tbody td {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
      vertical-align: middle;
    }
    .table tbody tr:last-child td {
      border-bottom: none;
    }
    .table-hover tbody tr {
      transition: background 0.15s ease;
    }
    .table-hover tbody tr:hover {
      background: var(--bg-light);
    }
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .text-muted { color: var(--text-muted); }
    .fw-normal { font-weight: 400; }
    .fw-semibold {
      font-weight: 600;
      color: var(--text-dark);
      text-decoration: none;
    }
    .fw-semibold:hover {
      color: var(--primary);
    }
    .py-4 { padding-top: 1.5rem; padding-bottom: 1.5rem; }

    /* User Name Cell */
    .user-name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .user-icon {
      width: 20px;
      height: 20px;
      color: #64748b;
      flex-shrink: 0;
    }

    /* Role Badges */
    .role-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .role-badge {
      display: inline-block;
      padding: 2px 8px;
      background: var(--primary-light);
      color: var(--primary);
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    /* Pagination */
    .pagination-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pagination-list {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 4px;
    }
    .pagination-list li a {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .pagination-list li a:hover {
      background: var(--bg-light);
      color: var(--text-dark);
    }
    .pagination-list li a.active {
      background: var(--primary);
      color: white;
    }
    .pagination-list li a.disabled {
      opacity: 0.4;
      pointer-events: none;
    }
    .pagination-list li a svg {
      width: 16px;
      height: 16px;
    }

    /* Button Styles */
    .btn-icon-action {
      width: 32px;
      height: 32px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      transition: all 0.15s ease;
    }
    .btn-icon-action:hover {
      background: rgba(0, 0, 0, 0.04);
      color: #374151;
    }
    .btn-icon-action:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-icon-action svg {
      width: 16px;
      height: 16px;
    }
    .btn-icon-action-sm {
      width: 28px;
      height: 28px;
    }
    .btn-icon-action-sm svg {
      width: 14px;
      height: 14px;
    }
    .btn-icon-add {
      background: #3b82f6;
      color: white;
    }
    .btn-icon-add:hover {
      background: #2563eb;
      color: white;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .modal-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }
    .close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: #f1f5f9;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 20px;
      line-height: 1;
    }
    .close-btn:hover {
      background: #e2e8f0;
      color: #374151;
    }
    .modal-body {
      padding: 20px;
      max-height: 60vh;
      overflow-y: auto;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid #e2e8f0;
    }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group:last-child {
      margin-bottom: 0;
    }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }
    .form-control {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      color: #374151;
      transition: border-color 0.15s ease;
    }
    .form-control:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .roles-select {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }
    .role-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
    }
    .role-checkbox input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--primary);
    }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-secondary {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #64748b;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
      color: #374151;
    }
    .btn-primary {
      background: #3b82f6;
      border: 1px solid #3b82f6;
      color: white;
    }
    .btn-primary:hover {
      background: #2563eb;
      border-color: #2563eb;
    }
    .btn-primary:disabled {
      background: #94a3b8;
      border-color: #94a3b8;
      cursor: not-allowed;
    }
  `]
})
export class UsersComponent implements OnInit {
  clients: Client[] = [];
  selectedClient: Client | null = null;
  searchTerm = '';
  loading = false;
  dropdownOpen = false;

  // Role-based access
  hasRoleSuper = false;
  userClientId: string | null = null;

  // Users
  users: User[] = [];
  loadingUsers = false;
  userCurrentPage = 0;
  userTotalPages = 0;
  userPageSize = 20;

  // Roles
  availableRoles: Role[] = [];

  // User Modal
  showUserModal = false;
  editingUser: User | null = null;
  userForm = { name: '', username: '', password: '', roles: [] as string[] };
  savingUser = false;

  private searchSubject = new Subject<string>();

  constructor(
    private clientService: ClientService,
    private userService: UserService,
    private roleService: RoleService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.initUserRoles();
    this.loadClients();
    this.loadRoles();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.loadClients(term);
    });
  }

  private initUserRoles(): void {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      const roles: string[] = decoded.roles || [];
      this.hasRoleSuper = roles.includes('SUPER');
      this.userClientId = decoded.clientId || null;
    } catch {
      this.hasRoleSuper = false;
      this.userClientId = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const selector = this.elementRef.nativeElement.querySelector('.selector-wrapper');
    if (selector && !selector.contains(event.target)) {
      this.dropdownOpen = false;
    }
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
    if (this.dropdownOpen) {
      this.loadClients(this.searchTerm);
    }
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  loadClients(search?: string): void {
    this.loading = true;
    if (this.hasRoleSuper) {
      this.clientService.getClients(0, 50, search).subscribe({
        next: (response) => {
          this.clients = response.content;
          this.loading = false;
          this.autoSelectIfSingleClient();
        },
        error: (err) => {
          console.error('Error loading clients:', err);
          this.clients = [];
          this.loading = false;
        }
      });
    } else if (this.userClientId) {
      this.clientService.getClient(this.userClientId).subscribe({
        next: (client) => {
          this.clients = [client];
          this.loading = false;
          this.autoSelectIfSingleClient();
        },
        error: (err) => {
          console.error('Error loading client:', err);
          this.clients = [];
          this.loading = false;
        }
      });
    } else {
      this.clients = [];
      this.loading = false;
    }
  }

  private autoSelectIfSingleClient(): void {
    if (this.clients.length === 1 && !this.selectedClient) {
      this.selectClient(this.clients[0]);
    }
  }

  loadRoles(): void {
    this.roleService.getRoles(0, 100).subscribe({
      next: (response) => {
        this.availableRoles = response.content;
      },
      error: (err) => {
        console.error('Error loading roles:', err);
        this.availableRoles = [];
      }
    });
  }

  selectClient(client: Client): void {
    this.selectedClient = client;
    this.dropdownOpen = false;
    this.searchTerm = '';
    this.loadUsers();
  }

  // User Methods
  loadUsers(): void {
    if (!this.selectedClient?.id) return;

    this.loadingUsers = true;
    this.userService.getUsersByClientId(this.selectedClient.id, this.userCurrentPage, this.userPageSize).subscribe({
      next: (response) => {
        this.users = response.content;
        this.userTotalPages = response.totalPages;
        this.loadingUsers = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.users = [];
        this.loadingUsers = false;
      }
    });
  }

  loadUserPage(page: number): void {
    if (page < 0 || page >= this.userTotalPages) return;
    this.userCurrentPage = page;
    this.loadUsers();
  }

  // Pagination helper
  getPageNumbers(totalPages: number, currentPage: number): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible);

    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // User Modal Methods
  openUserModal(): void {
    this.editingUser = null;
    this.userForm = { name: '', username: '', password: '', roles: [] };
    this.showUserModal = true;
  }

  editUser(user: User): void {
    this.editingUser = user;
    this.userForm = {
      name: user.name,
      username: user.username,
      password: '',
      roles: [...user.roles]
    };
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.editingUser = null;
    this.userForm = { name: '', username: '', password: '', roles: [] };
  }

  toggleRole(roleName: string): void {
    const index = this.userForm.roles.indexOf(roleName);
    if (index === -1) {
      this.userForm.roles.push(roleName);
    } else {
      this.userForm.roles.splice(index, 1);
    }
  }

  saveUser(): void {
    if (!this.userForm.name || !this.userForm.username || !this.selectedClient?.id) return;
    if (!this.editingUser && !this.userForm.password) return;

    this.savingUser = true;

    if (this.editingUser) {
      const updateRequest = {
        username: this.userForm.username,
        name: this.userForm.name,
        roles: this.userForm.roles,
        ...(this.userForm.password && { password: this.userForm.password })
      };
      this.userService.updateUser(this.editingUser.id!, updateRequest).subscribe({
        next: () => {
          this.savingUser = false;
          this.closeUserModal();
          this.loadUsers();
        },
        error: (err) => {
          console.error('Error updating user:', err);
          this.savingUser = false;
        }
      });
    } else {
      const createRequest = {
        username: this.userForm.username,
        password: this.userForm.password,
        name: this.userForm.name,
        roles: this.userForm.roles,
        clientId: this.selectedClient.id
      };
      this.userService.createUser(createRequest).subscribe({
        next: () => {
          this.savingUser = false;
          this.closeUserModal();
          this.loadUsers();
        },
        error: (err) => {
          console.error('Error creating user:', err);
          this.savingUser = false;
        }
      });
    }
  }
}