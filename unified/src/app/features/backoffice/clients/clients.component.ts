import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ClientService, Client } from './client.service';
import { ClientTypeService, ClientType } from '../configuration/client-types/client-type.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <!-- Clients Section -->
    <div class="section-container">
      <div class="card stretch">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>
                    <div class="th-with-search">
                      <span>{{ 'CLIENTS.TITLE' | translate }}</span>
                      <div class="search-input-wrapper">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="search-icon">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input type="text" class="search-input" [placeholder]="'COMMON.SEARCH' | translate" [(ngModel)]="clientSearchTerm" (input)="onClientSearch()">
                      </div>
                    </div>
                  </th>
                  <th>{{ 'COMMON.PHONE' | translate }}</th>
                  <th>{{ 'CLIENT_TYPES.TYPE' | translate }}</th>
                  <th>{{ 'COMMON.STATUS' | translate }}</th>
                  <th class="text-end">
                    <button class="btn-icon-action btn-icon-add" (click)="openClientModal(); $event.stopPropagation()" title="Add Client">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                @if (loadingClients) {
                  <tr><td colspan="5" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                } @else if (clients.length === 0) {
                  <tr><td colspan="5" class="text-center py-4 text-muted">{{ 'CLIENTS.NO_CLIENTS' | translate }}</td></tr>
                } @else {
                  @for (client of clients; track client.id) {
                    <tr>
                      <td>
                        <div class="client-info-cell">
                          <div class="client-avatar" [style.background]="getAvatarColor(client.name)">
                            @if (client.logoPath) {
                              <img [src]="clientService.getLogoUrl(client.logoPath)" alt="" class="client-logo-img">
                            } @else {
                              {{ getInitials(client.name) }}
                            }
                          </div>
                          <div class="client-details">
                            <a href="javascript:void(0);" class="client-name fw-semibold">{{ client.name }}</a>
                            <span class="client-email text-muted">{{ client.email || '-' }}</span>
                          </div>
                        </div>
                      </td>
                      <td class="text-muted">{{ client.phone || '-' }}</td>
                      <td class="text-muted">{{ client.clientTypeName || '-' }}</td>
                      <td>
                        <span class="status-badge" [class.status-active]="client.status === 'ACTIVE'"
                              [class.status-inactive]="client.status === 'INACTIVE'"
                              [class.status-pending]="client.status === 'PENDING'">
                          {{ client.status === 'ACTIVE' ? ('COMMON.ACTIVE' | translate) : client.status === 'INACTIVE' ? ('COMMON.INACTIVE' | translate) : client.status }}
                        </span>
                      </td>
                      <td class="text-end">
                        <button class="btn-icon-action btn-icon-action-sm" (click)="editClient(client); $event.stopPropagation()" title="Edit Client">
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
        <div class="card-footer">
          <div class="pagination-container">
            <ul class="pagination-list">
              <li><a href="javascript:void(0);" (click)="loadClientPage(clientCurrentPage - 1)" [class.disabled]="clientCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
              @for (page of getPageNumbers(clientTotalPages, clientCurrentPage); track page) {
                <li><a href="javascript:void(0);" [class.active]="page === clientCurrentPage" (click)="loadClientPage(page)">{{ page + 1 }}</a></li>
              }
              <li><a href="javascript:void(0);" (click)="loadClientPage(clientCurrentPage + 1)" [class.disabled]="clientCurrentPage >= clientTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
            </ul>
            <select class="page-size-select" [ngModel]="clientPageSize" (ngModelChange)="onClientPageSizeChange($event)">
              @for (size of pageSizeOptions; track size) {
                <option [value]="size">{{ size }}</option>
              }
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Client Modal -->
    @if (showClientModal) {
      <div class="modal-overlay" (mousedown)="closeClientModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingClient ? ('COMMON.EDIT' | translate) : ('COMMON.ADD' | translate) }} {{ 'CLIENTS.CLIENT' | translate }}</h3>
            <button class="close-btn" (click)="closeClientModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="clientName">{{ 'COMMON.NAME' | translate }}</label>
              <input type="text" id="clientName" class="form-control" [(ngModel)]="clientFormData.name" [placeholder]="'COMMON.NAME' | translate">
            </div>
            <div class="form-group">
              <label for="clientEmail">{{ 'COMMON.EMAIL' | translate }}</label>
              <input type="email" id="clientEmail" class="form-control" [(ngModel)]="clientFormData.email" [placeholder]="'COMMON.EMAIL' | translate">
            </div>
            <div class="form-group">
              <label for="clientPhone">{{ 'COMMON.PHONE' | translate }}</label>
              <input type="tel" id="clientPhone" class="form-control" [(ngModel)]="clientFormData.phone" [placeholder]="'COMMON.PHONE' | translate">
            </div>
            <div class="form-group">
              <label>{{ 'COMMON.STATUS' | translate }}</label>
              <div class="custom-select" [class.open]="statusDropdownOpen" (click)="toggleStatusDropdown(); $event.stopPropagation()">
                <div class="custom-select-trigger">
                  <span class="selected-value">
                    @if (clientFormData.status === 'ACTIVE') {
                      <span class="status-dot status-dot-active"></span>
                      {{ 'COMMON.ACTIVE' | translate }}
                    } @else {
                      <span class="status-dot status-dot-inactive"></span>
                      {{ 'COMMON.INACTIVE' | translate }}
                    }
                  </span>
                  <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                @if (statusDropdownOpen) {
                  <div class="custom-select-options">
                    <div class="custom-select-option" [class.selected]="clientFormData.status === 'ACTIVE'" (click)="selectStatus('ACTIVE'); $event.stopPropagation()">
                      <span class="status-dot status-dot-active"></span>
                      {{ 'COMMON.ACTIVE' | translate }}
                      @if (clientFormData.status === 'ACTIVE') {
                        <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      }
                    </div>
                    <div class="custom-select-option" [class.selected]="clientFormData.status === 'INACTIVE'" (click)="selectStatus('INACTIVE'); $event.stopPropagation()">
                      <span class="status-dot status-dot-inactive"></span>
                      {{ 'COMMON.INACTIVE' | translate }}
                      @if (clientFormData.status === 'INACTIVE') {
                        <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'CLIENT_TYPES.TYPE' | translate }}</label>
              <div class="custom-select" [class.open]="clientTypeDropdownOpen" (click)="toggleClientTypeDropdown(); $event.stopPropagation()">
                <div class="custom-select-trigger">
                  <span class="selected-value" [class.placeholder]="!clientFormData.clientTypeId">
                    {{ getSelectedClientTypeName() || ('CLIENT_TYPES.SELECT' | translate) }}
                  </span>
                  <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                @if (clientTypeDropdownOpen) {
                  <div class="custom-select-options">
                    <div class="custom-select-option" [class.selected]="!clientFormData.clientTypeId" (click)="selectClientType(''); $event.stopPropagation()">
                      <span class="option-text placeholder-text">{{ 'CLIENT_TYPES.SELECT' | translate }}</span>
                      @if (!clientFormData.clientTypeId) {
                        <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      }
                    </div>
                    @for (ct of clientTypes; track ct.id) {
                      <div class="custom-select-option" [class.selected]="clientFormData.clientTypeId === ct.id" (click)="selectClientType(ct.id!); $event.stopPropagation()">
                        <span class="option-text">{{ ct.name }}</span>
                        @if (clientFormData.clientTypeId === ct.id) {
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
            @if (editingClient) {
              <div class="form-group">
                <label>Logo</label>
                <div class="logo-upload-container">
                  @if (editingClient.logoPath) {
                    <div class="logo-preview">
                      <img [src]="clientService.getLogoUrl(editingClient.logoPath)" alt="Logo">
                      <button class="btn-delete-logo" (click)="deleteClientLogo()" [disabled]="uploadingClientLogo" title="Delete Logo">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  } @else {
                    <div class="logo-upload-box">
                      <input type="file" id="clientLogo" accept="image/*" (change)="onClientLogoSelected($event)" [disabled]="uploadingClientLogo">
                      <label for="clientLogo" class="upload-label">
                        @if (uploadingClientLogo) {
                          <span>{{ 'COMMON.UPLOADING' | translate }}...</span>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{{ 'COMMON.CLICK_TO_UPLOAD' | translate }}</span>
                        }
                      </label>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeClientModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveClient()" [disabled]="savingClient">
              {{ savingClient ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
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
      --warning: #f59e0b;
      --text-dark: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --bg-light: #f8fafc;
      --white: #ffffff;
      display: block;
      height: 100%;
    }

    /* Section Container */
    .section-container { display: flex; flex-direction: column; height: 100%; min-height: 0; }

    /* Card */
    .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card.stretch { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .card-body { padding: 20px; }
    .card-body.p-0 { padding: 0 !important; flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .card-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; flex-shrink: 0; }

    /* Table */
    .table-responsive { flex: 1; overflow-y: auto; min-height: 0; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 12px 20px; text-align: left; border-bottom: 1px solid var(--border-color); }
    .table th { font-size: 13px; font-weight: 600; color: var(--text-dark); background: var(--bg-light); position: sticky; top: 0; z-index: 10; }
    .table td { font-size: 14px; color: var(--text-dark); }
    .table-hover tbody tr:hover { background: var(--bg-light); cursor: pointer; }
    .table.mb-0 { margin-bottom: 0; }
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .text-muted { color: var(--text-muted); }
    .py-4 { padding-top: 24px; padding-bottom: 24px; }

    .th-with-search { display: flex; align-items: center; gap: 12px; }
    .search-input-wrapper { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: white; }
    .search-input-wrapper .search-icon { width: 14px; height: 14px; color: var(--text-muted); }
    .search-input-wrapper .search-input { border: none; outline: none; font-size: 13px; width: 150px; background: transparent; }

    /* Client Info Cell */
    .client-info-cell { display: flex; align-items: center; gap: 12px; }
    .client-avatar { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: white; flex-shrink: 0; overflow: hidden; }
    .client-logo-img { width: 100%; height: 100%; object-fit: cover; }
    .client-details { display: flex; flex-direction: column; gap: 2px; }
    .client-name { font-size: 14px; font-weight: 600; color: var(--text-dark); text-decoration: none; }
    .client-email { font-size: 12px; color: var(--text-muted); }
    .fw-semibold { font-weight: 600; }

    /* Status Badge */
    .status-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-active { background: rgba(12, 175, 96, 0.1); color: var(--success); }
    .status-inactive { background: rgba(253, 106, 106, 0.1); color: var(--danger); }
    .status-pending { background: rgba(245, 158, 11, 0.1); color: var(--warning); }

    /* Buttons */
    .btn-icon-action { width: 32px; height: 32px; border: 1px solid rgba(0, 0, 0, 0.08); background: transparent; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #64748b; transition: all 0.15s ease; margin-left: 4px; }
    .btn-icon-action:hover { background: rgba(0, 0, 0, 0.04); color: #374151; }
    .btn-icon-action svg { width: 16px; height: 16px; }
    .btn-icon-action-sm { width: 28px; height: 28px; }
    .btn-icon-action-sm svg { width: 14px; height: 14px; }
    .btn-icon-add { background: var(--primary); border-color: var(--primary); color: white; }
    .btn-icon-add:hover { background: #2563eb; border-color: #2563eb; color: white; }

    .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
    .btn-primary { background: var(--primary); color: white; border-color: var(--primary); }
    .btn-primary:hover { background: #2563eb; border-color: #2563eb; }
    .btn-primary:disabled { background: #94a3b8; border-color: #94a3b8; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
    .btn-secondary:hover { background: #e2e8f0; color: #374151; }

    /* Pagination */
    .pagination-container { display: flex; align-items: center; gap: 16px; width: 100%; justify-content: flex-end; }
    .pagination-list { display: flex; align-items: center; gap: 4px; list-style: none; margin: 0; padding: 0; }
    .pagination-list li a { display: flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 8px; border-radius: 6px; font-size: 13px; color: var(--text-muted); text-decoration: none; transition: all 0.15s ease; }
    .pagination-list li a:hover:not(.disabled):not(.active) { background: var(--bg-light); color: var(--text-dark); }
    .pagination-list li a.active { background: var(--primary); color: white; }
    .pagination-list li a.disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .pagination-list li a svg { width: 16px; height: 16px; }
    .page-size-select { padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px; color: var(--text-dark); background: white; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; width: 100%; max-width: 500px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15); max-height: 90vh; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
    .modal-header h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; }
    .close-btn { width: 32px; height: 32px; border: none; background: #f1f5f9; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 20px; }
    .close-btn:hover { background: #e2e8f0; color: #374151; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px; }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-dark); box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    select.form-control { appearance: auto; cursor: pointer; }

    /* Logo Upload */
    .logo-upload-container { margin-top: 8px; }
    .logo-preview { display: flex; align-items: center; gap: 16px; }
    .logo-preview img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color); }
    .btn-delete-logo { width: 32px; height: 32px; border: none; background: rgba(253, 106, 106, 0.1); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--danger); }
    .btn-delete-logo:hover { background: rgba(253, 106, 106, 0.2); }
    .btn-delete-logo svg { width: 16px; height: 16px; }
    .logo-upload-box { position: relative; }
    .logo-upload-box input[type="file"] { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
    .upload-label { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; border: 2px dashed var(--border-color); border-radius: 8px; cursor: pointer; transition: all 0.2s ease; }
    .upload-label:hover { border-color: var(--primary); background: var(--primary-light); }
    .upload-label svg { width: 32px; height: 32px; color: var(--text-muted); margin-bottom: 8px; }
    .upload-label span { font-size: 13px; color: var(--text-muted); }

    /* Custom Select - Duralux Style */
    .custom-select {
      position: relative;
      width: 100%;
      cursor: pointer;
    }
    .custom-select-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-dark);
      transition: all 0.2s ease;
    }
    .custom-select:hover .custom-select-trigger {
      border-color: #cbd5e1;
    }
    .custom-select.open .custom-select-trigger {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-light);
    }
    .selected-value {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .selected-value.placeholder {
      color: var(--text-muted);
      font-weight: 400;
    }
    .dropdown-arrow {
      width: 16px;
      height: 16px;
      color: var(--text-muted);
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .custom-select.open .dropdown-arrow {
      transform: rotate(180deg);
    }
    .custom-select-options {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
      z-index: 100;
      overflow: hidden;
      animation: dropdownFadeIn 0.15s ease;
    }
    @keyframes dropdownFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .custom-select-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      font-size: 14px;
      color: var(--text-dark);
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .custom-select-option:hover {
      background: var(--bg-light);
    }
    .custom-select-option.selected {
      background: var(--primary-light);
      color: var(--primary);
      font-weight: 500;
    }
    .custom-select-option:first-child {
      border-radius: 9px 9px 0 0;
    }
    .custom-select-option:last-child {
      border-radius: 0 0 9px 9px;
    }
    .custom-select-option:only-child {
      border-radius: 9px;
    }
    .option-text {
      flex: 1;
    }
    .placeholder-text {
      color: var(--text-muted);
    }
    .check-icon {
      width: 16px;
      height: 16px;
      color: var(--primary);
      margin-left: auto;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-dot-active {
      background: var(--success);
    }
    .status-dot-inactive {
      background: var(--danger);
    }
  `]
})
export class ClientsComponent implements OnInit {
  // Clients
  clients: Client[] = [];
  loadingClients = false;
  clientSearchTerm = '';
  clientCurrentPage = 0;
  clientTotalPages = 0;
  clientPageSize = 10;
  pageSizeOptions = [5, 10, 20, 50];

  // Role-based access
  hasRoleSuper = false;
  userClientId: string | null = null;

  // Client Modal
  showClientModal = false;
  editingClient: Client | null = null;
  savingClient = false;
  clientFormData: { name: string; email: string; phone: string; status: string; clientTypeId: string } = {
    name: '', email: '', phone: '', status: 'ACTIVE', clientTypeId: ''
  };

  // Client Types
  clientTypes: ClientType[] = [];
  loadingClientTypes = false;

  // Logo Upload
  uploadingClientLogo = false;

  // Dropdown States
  statusDropdownOpen = false;
  clientTypeDropdownOpen = false;

  constructor(
    public clientService: ClientService,
    private clientTypeService: ClientTypeService
  ) {}

  ngOnInit(): void {
    this.initUserRoles();
    this.loadClients();
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

  // Client Methods
  loadClients(): void {
    this.loadingClients = true;

    if (this.hasRoleSuper) {
      // SUPER users can see all clients
      this.clientService.getClients(this.clientCurrentPage, this.clientPageSize, this.clientSearchTerm || undefined).subscribe({
        next: (response) => {
          this.clients = response.content;
          this.clientTotalPages = response.totalPages;
          this.loadingClients = false;
        },
        error: (err) => {
          console.error('Error loading clients:', err);
          this.loadingClients = false;
        }
      });
    } else if (this.userClientId) {
      // Non-SUPER users can only see their own client
      this.clientService.getClient(this.userClientId).subscribe({
        next: (client) => {
          this.clients = [client];
          this.clientTotalPages = 1;
          this.loadingClients = false;
        },
        error: (err) => {
          console.error('Error loading client:', err);
          this.clients = [];
          this.loadingClients = false;
        }
      });
    } else {
      this.clients = [];
      this.clientTotalPages = 0;
      this.loadingClients = false;
    }
  }

  onClientSearch(): void {
    this.clientCurrentPage = 0;
    this.loadClients();
  }

  loadClientPage(page: number): void {
    if (page < 0 || page >= this.clientTotalPages) return;
    this.clientCurrentPage = page;
    this.loadClients();
  }

  onClientPageSizeChange(size: number): void {
    this.clientPageSize = +size;
    this.clientCurrentPage = 0;
    this.loadClients();
  }

  openClientModal(): void {
    this.editingClient = null;
    this.clientFormData = { name: '', email: '', phone: '', status: 'ACTIVE', clientTypeId: '' };
    this.loadClientTypes();
    this.showClientModal = true;
  }

  editClient(client: Client): void {
    this.editingClient = client;
    this.clientFormData = {
      name: client.name,
      email: client.email,
      phone: client.phone,
      status: client.status,
      clientTypeId: client.clientTypeId || ''
    };
    this.loadClientTypes();
    this.showClientModal = true;
  }

  loadClientTypes(): void {
    if (this.clientTypes.length > 0) return;
    this.loadingClientTypes = true;
    this.clientTypeService.getClientTypes(0, 100).subscribe({
      next: (response) => {
        this.clientTypes = response.content;
        this.loadingClientTypes = false;
      },
      error: (err) => {
        console.error('Error loading client types:', err);
        this.loadingClientTypes = false;
      }
    });
  }

  closeClientModal(): void {
    this.showClientModal = false;
    this.editingClient = null;
  }

  saveClient(): void {
    this.savingClient = true;
    const operation = this.editingClient
      ? this.clientService.updateClient(this.editingClient.id!, this.clientFormData)
      : this.clientService.createClient(this.clientFormData);
    operation.subscribe({
      next: () => {
        this.closeClientModal();
        this.loadClients();
        this.savingClient = false;
      },
      error: (err) => {
        console.error('Error saving client:', err);
        this.savingClient = false;
      }
    });
  }

  // Logo Methods
  onClientLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.editingClient?.id) return;
    this.uploadingClientLogo = true;
    this.clientService.uploadLogo(this.editingClient.id, file).subscribe({
      next: (updated) => {
        if (this.editingClient) {
          this.editingClient.logoPath = updated.logoPath;
        }
        this.uploadingClientLogo = false;
        this.loadClients();
      },
      error: (err) => {
        console.error('Error uploading logo:', err);
        this.uploadingClientLogo = false;
      }
    });
  }

  deleteClientLogo(): void {
    if (!this.editingClient?.id) return;
    this.uploadingClientLogo = true;
    this.clientService.deleteLogo(this.editingClient.id).subscribe({
      next: () => {
        if (this.editingClient) {
          this.editingClient.logoPath = undefined;
        }
        this.uploadingClientLogo = false;
        this.loadClients();
      },
      error: (err) => {
        console.error('Error deleting logo:', err);
        this.uploadingClientLogo = false;
      }
    });
  }

  // Utility Methods
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

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = ['#3b82f6', '#0caf60', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // Dropdown Methods
  toggleStatusDropdown(): void {
    this.statusDropdownOpen = !this.statusDropdownOpen;
    if (this.statusDropdownOpen) {
      this.clientTypeDropdownOpen = false;
    }
  }

  toggleClientTypeDropdown(): void {
    this.clientTypeDropdownOpen = !this.clientTypeDropdownOpen;
    if (this.clientTypeDropdownOpen) {
      this.statusDropdownOpen = false;
    }
  }

  selectStatus(status: string): void {
    this.clientFormData.status = status;
    this.statusDropdownOpen = false;
  }

  selectClientType(clientTypeId: string): void {
    this.clientFormData.clientTypeId = clientTypeId;
    this.clientTypeDropdownOpen = false;
  }

  getSelectedClientTypeName(): string {
    if (!this.clientFormData.clientTypeId) return '';
    const ct = this.clientTypes.find(t => t.id === this.clientFormData.clientTypeId);
    return ct?.name || '';
  }

  closeDropdowns(): void {
    this.statusDropdownOpen = false;
    this.clientTypeDropdownOpen = false;
  }
}