import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ClientService, Client } from '../clients/client.service';
import { LocationService, Location } from '../clients/location.service';
import { MenuManagementService, Menu } from '../clients/menu-management.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-menu-management',
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

      <!-- Locations and Menus Split Layout -->
    @if (selectedClient) {
      <div class="split-layout">
        <!-- Locations Panel -->
        <div class="locations-panel">
          <div class="card stretch">
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>{{ 'LOCATIONS.LOCATION' | translate }} <span class="text-muted fw-normal">- {{ selectedClient.name }}</span></th>
                      <th class="text-end"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @if (loadingLocations) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                    } @else if (locations.length === 0) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'LOCATIONS.NO_LOCATIONS' | translate }}</td></tr>
                    } @else {
                      @for (location of locations; track location.id) {
                        <tr [class.selected]="selectedLocation?.id === location.id" (click)="selectLocation(location)">
                          <td>
                            <div class="location-name-cell" [class.sublocation]="location.parentId">
                              <svg class="location-pin-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <a href="javascript:void(0);" class="fw-semibold">{{ location.name }}</a>
                            </div>
                          </td>
                          <td class="text-end"></td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
            @if (locationTotalPages > 1) {
              <div class="card-footer">
                <div class="pagination-container">
                  <ul class="pagination-list">
                    <li><a href="javascript:void(0);" (click)="loadLocationPage(locationCurrentPage - 1)" [class.disabled]="locationCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
                    @for (page of getPageNumbers(locationTotalPages, locationCurrentPage); track page) {
                      <li><a href="javascript:void(0);" [class.active]="page === locationCurrentPage" (click)="loadLocationPage(page)">{{ page + 1 }}</a></li>
                    }
                    <li><a href="javascript:void(0);" (click)="loadLocationPage(locationCurrentPage + 1)" [class.disabled]="locationCurrentPage >= locationTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
                  </ul>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Menus Panel -->
        <div class="details-panel">
          <div class="card stretch">
            <div class="card-header">
              <h6 class="card-title">{{ 'MENUS.TITLE' | translate }} @if (selectedLocation) { <span class="text-muted fw-normal">- {{ selectedLocation.name }}</span> }</h6>
              <button class="btn-icon-action btn-icon-add" (click)="openMenuModal()" [disabled]="!selectedLocation" [title]="'MENUS.ADD_MENU' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>{{ 'MENUS.MENU_NAME' | translate }}</th>
                      <th class="col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @if (!selectedLocation) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'MENUS.SELECT_LOCATION' | translate }}</td></tr>
                    } @else if (loadingMenus) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                    } @else if (menus.length === 0) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'MENUS.NO_MENUS' | translate }}</td></tr>
                    } @else {
                      @for (menu of menus; track menu.id) {
                        <tr>
                          <td>
                            <a href="javascript:void(0);" class="fw-semibold">{{ menu.name }}</a>
                          </td>
                          <td class="text-end col-actions">
                            <div class="action-buttons">
                              <button class="btn-icon-action btn-icon-action-sm" (click)="editMenu(menu)" [title]="'MENUS.EDIT_MENU' | translate">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button class="btn-icon-action btn-icon-action-sm btn-icon-delete" (click)="confirmDeleteMenu(menu)" [title]="'COMMON.DELETE' | translate">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
            @if (menuTotalPages > 1) {
              <div class="card-footer">
                <div class="pagination-container">
                  <ul class="pagination-list">
                    <li><a href="javascript:void(0);" (click)="loadMenuPage(menuCurrentPage - 1)" [class.disabled]="menuCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
                    @for (page of getPageNumbers(menuTotalPages, menuCurrentPage); track page) {
                      <li><a href="javascript:void(0);" [class.active]="page === menuCurrentPage" (click)="loadMenuPage(page)">{{ page + 1 }}</a></li>
                    }
                    <li><a href="javascript:void(0);" (click)="loadMenuPage(menuCurrentPage + 1)" [class.disabled]="menuCurrentPage >= menuTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
                  </ul>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
    </div>

    <!-- Menu Modal -->
    @if (showMenuModal) {
      <div class="modal-overlay" (mousedown)="closeMenuModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingMenu ? ('MENUS.EDIT_MENU' | translate) : ('MENUS.ADD_MENU' | translate) }}</h3>
            <button class="close-btn" (click)="closeMenuModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="menuName">{{ 'MENUS.MENU_NAME' | translate }}</label>
              <input type="text" id="menuName" class="form-control" [(ngModel)]="menuForm.name" [placeholder]="'MENUS.ENTER_NAME' | translate">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeMenuModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveMenu()" [disabled]="!menuForm.name || savingMenu">
              {{ savingMenu ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (showDeleteModal) {
      <div class="modal-overlay" (mousedown)="closeDeleteModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ 'COMMON.DELETE' | translate }}</h3>
            <button class="close-btn" (click)="closeDeleteModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <p>{{ 'MENUS.DELETE_CONFIRM' | translate }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeDeleteModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-danger" (click)="deleteMenu()" [disabled]="deletingMenu">
              {{ deletingMenu ? ('COMMON.LOADING' | translate) : ('COMMON.DELETE' | translate) }}
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

    /* Split Layout */
    .split-layout {
      display: flex;
      gap: 24px;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .locations-panel {
      flex: 0 0 calc(40% - 12px);
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .details-panel {
      flex: 0 0 calc(60% - 12px);
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .card.stretch {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      background: var(--white);
      flex-shrink: 0;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      color: var(--text-dark);
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
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .table-hover tbody tr:hover {
      background: var(--bg-light);
    }
    .table-hover tbody tr.selected {
      background: var(--primary-light) !important;
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

    /* Location Name Cell */
    .location-name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .location-pin-icon {
      width: 20px;
      height: 20px;
      color: #3b82f6;
      flex-shrink: 0;
    }
    .location-name-cell.sublocation {
      padding-left: 24px;
    }
    .location-name-cell.sublocation .location-pin-icon {
      color: #93c5fd;
      width: 16px;
      height: 16px;
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
    .btn-icon-delete { }
    .btn-icon-delete:hover {
      background: rgba(253, 106, 106, 0.1);
      color: #dc2626;
      border-color: rgba(253, 106, 106, 0.3);
    }
    .action-buttons {
      display: inline-flex;
      gap: 5px;
    }
    .col-actions {
      width: 80px;
      vertical-align: middle !important;
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
    }
    .modal-body p {
      margin: 0;
      font-size: 14px;
      color: #374151;
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
    .btn-danger {
      background: #dc2626;
      border: 1px solid #dc2626;
      color: white;
    }
    .btn-danger:hover {
      background: #b91c1c;
      border-color: #b91c1c;
    }
    .btn-danger:disabled {
      background: #94a3b8;
      border-color: #94a3b8;
      cursor: not-allowed;
    }
  `]
})
export class MenuManagementComponent implements OnInit {
  clients: Client[] = [];
  selectedClient: Client | null = null;
  searchTerm = '';
  loading = false;
  dropdownOpen = false;

  // Role-based access
  hasRoleSuper = false;
  userClientId: string | null = null;

  // Locations
  locations: Location[] = [];
  selectedLocation: Location | null = null;
  loadingLocations = false;
  locationCurrentPage = 0;
  locationTotalPages = 0;
  locationPageSize = 20;

  // Menus
  menus: Menu[] = [];
  loadingMenus = false;
  menuCurrentPage = 0;
  menuTotalPages = 0;
  menuPageSize = 20;

  // Menu Modal
  showMenuModal = false;
  editingMenu: Menu | null = null;
  menuForm = { name: '' };
  savingMenu = false;

  // Delete Modal
  showDeleteModal = false;
  menuToDelete: Menu | null = null;
  deletingMenu = false;

  private searchSubject = new Subject<string>();

  constructor(
    private clientService: ClientService,
    private locationService: LocationService,
    private menuManagementService: MenuManagementService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.initUserRoles();
    this.loadClients();

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

  selectClient(client: Client): void {
    this.selectedClient = client;
    this.dropdownOpen = false;
    this.searchTerm = '';
    this.selectedLocation = null;
    this.menus = [];
    this.loadLocations();
  }

  // Location Methods
  loadLocations(): void {
    if (!this.selectedClient?.id) return;

    this.loadingLocations = true;
    this.locationService.getLocationsByClientId(this.selectedClient.id, this.locationCurrentPage, this.locationPageSize).subscribe({
      next: (response) => {
        const parents = response.content.filter(l => !l.parentId);
        const children = response.content.filter(l => l.parentId);

        const sorted: Location[] = [];
        parents.forEach(parent => {
          sorted.push(parent);
          children.filter(c => c.parentId === parent.id).forEach(child => sorted.push(child));
        });

        this.locations = sorted;
        this.locationTotalPages = response.totalPages;
        this.loadingLocations = false;
      },
      error: (err) => {
        console.error('Error loading locations:', err);
        this.locations = [];
        this.loadingLocations = false;
      }
    });
  }

  loadLocationPage(page: number): void {
    if (page < 0 || page >= this.locationTotalPages) return;
    this.locationCurrentPage = page;
    this.loadLocations();
  }

  selectLocation(location: Location): void {
    this.selectedLocation = location;
    this.menuCurrentPage = 0;
    this.loadMenus();
  }

  // Menu Methods
  loadMenus(): void {
    if (!this.selectedLocation?.id) return;

    this.loadingMenus = true;
    this.menuManagementService.getMenusByLocationId(this.selectedLocation.id, this.menuCurrentPage, this.menuPageSize).subscribe({
      next: (response) => {
        this.menus = response.content;
        this.menuTotalPages = response.totalPages;
        this.loadingMenus = false;
      },
      error: (err) => {
        console.error('Error loading menus:', err);
        this.menus = [];
        this.loadingMenus = false;
      }
    });
  }

  loadMenuPage(page: number): void {
    if (page < 0 || page >= this.menuTotalPages) return;
    this.menuCurrentPage = page;
    this.loadMenus();
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

  // Menu Modal Methods
  openMenuModal(): void {
    if (!this.selectedLocation) return;
    this.editingMenu = null;
    this.menuForm = { name: '' };
    this.showMenuModal = true;
  }

  editMenu(menu: Menu): void {
    this.editingMenu = menu;
    this.menuForm = { name: menu.name };
    this.showMenuModal = true;
  }

  closeMenuModal(): void {
    this.showMenuModal = false;
    this.editingMenu = null;
    this.menuForm = { name: '' };
  }

  saveMenu(): void {
    if (!this.menuForm.name || !this.selectedLocation?.id) return;

    this.savingMenu = true;

    if (this.editingMenu) {
      this.menuManagementService.updateMenu(
        this.editingMenu.id!,
        this.menuForm.name,
        this.selectedLocation.id
      ).subscribe({
        next: () => {
          this.savingMenu = false;
          this.closeMenuModal();
          this.loadMenus();
        },
        error: (err) => {
          console.error('Error updating menu:', err);
          this.savingMenu = false;
        }
      });
    } else {
      this.menuManagementService.createMenu(
        this.selectedLocation.id,
        this.menuForm.name
      ).subscribe({
        next: () => {
          this.savingMenu = false;
          this.closeMenuModal();
          this.loadMenus();
        },
        error: (err) => {
          console.error('Error creating menu:', err);
          this.savingMenu = false;
        }
      });
    }
  }

  // Delete Methods
  confirmDeleteMenu(menu: Menu): void {
    this.menuToDelete = menu;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.menuToDelete = null;
  }

  deleteMenu(): void {
    if (!this.menuToDelete?.id) return;

    this.deletingMenu = true;
    this.menuManagementService.deleteMenu(this.menuToDelete.id).subscribe({
      next: () => {
        this.deletingMenu = false;
        this.closeDeleteModal();
        this.loadMenus();
      },
      error: (err) => {
        console.error('Error deleting menu:', err);
        this.deletingMenu = false;
      }
    });
  }
}
