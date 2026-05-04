import { Component, OnInit, HostListener, ElementRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ClientService, Client } from '../clients/client.service';
import { LocationService, Location } from '../clients/location.service';
import { OrderPointService, OrderPoint } from '../clients/order-point.service';
import { MenuService, Menu } from '../clients/menu.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  template: `
    <div class="page-container">
      <!-- Client Selector -->
      <div class="client-selector-container">
        <label class="selector-label">{{ 'CLIENTS.TITLE' | translate }}</label>
        <div class="selector-wrapper" [class.open]="dropdownOpen">
          <div class="selector-input" (click)="toggleDropdown()">
            @if (selectedClient) {
              <div class="selected-client">
                <span class="status-bullet" [class.bg-success]="selectedClient.status === 'ACTIVE'"
                [class.bg-danger]="selectedClient.status === 'INACTIVE'"></span>
                <span class="client-name">{{ selectedClient.name }}</span>
                @if (selectedClient.email || selectedClient.phone) {
                  <span class="client-details">
                    ({{ selectedClient.email || selectedClient.phone }})
                  </span>
                }
              </div>
            }
            @if (!selectedClient) {
              <div class="placeholder">
                {{ 'CLIENTS.SELECT_CLIENT' | translate }}
              </div>
            }
            <span class="dropdown-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
    
          @if (dropdownOpen) {
            <div class="selector-dropdown">
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
                @if (loading) {
                  <div class="loading-state">
                    {{ 'COMMON.LOADING' | translate }}
                  </div>
                }
                @if (!loading && clients.length === 0) {
                  <div class="empty-state">
                    {{ 'CLIENTS.NO_CLIENTS' | translate }}
                  </div>
                }
                @for (client of clients; track client) {
                  <div
                    class="client-option"
                    [class.selected]="selectedClient?.id === client.id"
                    (click)="selectClient(client)">
                    <span class="status-bullet" [class.bg-success]="client.status === 'ACTIVE'"
                    [class.bg-danger]="client.status === 'INACTIVE'"></span>
                    <div class="client-info">
                      <span class="client-name">{{ client.name }}</span>
                      <span class="client-details">
                        @if (client.email) {
                          <span>{{ client.email }}</span>
                        }
                        @if (client.email && client.phone) {
                          <span> · </span>
                        }
                        @if (client.phone) {
                          <span>{{ client.phone }}</span>
                        }
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    
      <!-- Locations and Order Points Split Layout -->
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
                        <th class="text-end">
                          <button class="btn-icon-action btn-icon-add" (click)="openLocationModal(); $event.stopPropagation()" [title]="'LOCATIONS.ADD_LOCATION' | translate">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </th>
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
                            <td class="text-end">
                              <div class="action-buttons">
                                @if (!location.parentId) {
                                  <button class="btn-icon-action btn-icon-action-sm" (click)="openSubLocationModal(location); $event.stopPropagation()" [title]="'LOCATIONS.ADD_SUBLOCATION' | translate">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                  </button>
                                }
                                <button class="btn-icon-action btn-icon-action-sm" (click)="editLocation(location); $event.stopPropagation()" [title]="'LOCATIONS.EDIT_LOCATION' | translate">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
    
          <!-- Order Points Panel -->
          <div class="details-panel">
            <div class="card stretch">
              <div class="card-header">
                <h6 class="card-title">{{ 'ORDER_POINTS.TITLE' | translate }} @if (selectedLocation) { <span class="text-muted fw-normal">- {{ selectedLocation.name }}</span> }</h6>
                <button class="btn-icon-action btn-icon-add" (click)="openMultipleModal()" [disabled]="!selectedLocation" [title]="'ORDER_POINTS.ADD_ORDER_POINT' | translate">
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
                        <th>{{ 'COMMON.NAME' | translate }}</th>
                        <th class="col-menu">Menu</th>
                        <th class="text-center col-pay-later">{{ 'ORDER_POINTS.PAY_LATER' | translate }}</th>
                        <th class="text-end col-actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @if (!selectedLocation) {
                        <tr><td colspan="4" class="text-center py-4 text-muted">{{ 'ORDER_POINTS.SELECT_LOCATION' | translate }}</td></tr>
                      } @else if (loadingOrderPoints) {
                        <tr><td colspan="4" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                      } @else if (orderPoints.length === 0) {
                        <tr><td colspan="4" class="text-center py-4 text-muted">{{ 'ORDER_POINTS.NO_ORDER_POINTS' | translate }}</td></tr>
                      } @else {
                        @for (orderPoint of orderPoints; track orderPoint.id) {
                          <tr>
                            <td>
                              <input type="text"
                                class="inline-name-input"
                                [value]="orderPoint.name"
                                (blur)="onNameChange(orderPoint, $event)"
                                (keydown.enter)="$any($event.target).blur()">
                            </td>
                            <td class="col-menu">
                              <select class="menu-select" [ngModel]="orderPoint.menuId || ''" (ngModelChange)="onMenuChange(orderPoint, $event)">
                                <option value="">-</option>
                                @for (menu of menus; track menu.id) {
                                  <option [value]="menu.id">{{ menu.name }}</option>
                                }
                              </select>
                            </td>
                            <td class="text-center col-pay-later">
                              <input type="checkbox"
                                class="table-checkbox"
                                [checked]="orderPoint.payLater"
                                (change)="togglePayLater(orderPoint, $event)">
                            </td>
                            <td class="text-end col-actions">
                              <div class="row-actions">
                                @if (orderPoint.payLater) {
                                  <button class="btn-icon-action btn-icon-action-sm btn-icon-split" (click)="splitOrderPoint(orderPoint)" [title]="'ORDER_POINTS.SPLIT' | translate">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 3h5v5M4 20l5-5M21 3l-7 7M4 4l5 5M16 21h5v-5M4 4h5v5" />
                                    </svg>
                                  </button>
                                }
                                <button class="btn-icon-action btn-icon-action-sm btn-icon-delete" (click)="deleteOrderPoint(orderPoint)" [title]="'COMMON.DELETE' | translate">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
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
              @if (orderPointTotalPages > 0) {
                <div class="card-footer">
                  <div class="pagination-container">
                    <ul class="pagination-list">
                      @if (orderPointTotalPages > 1) {
                        <li><a href="javascript:void(0);" (click)="loadOrderPointPage(orderPointCurrentPage - 1)" [class.disabled]="orderPointCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
                        @for (page of getPageNumbers(orderPointTotalPages, orderPointCurrentPage); track page) {
                          <li><a href="javascript:void(0);" [class.active]="page === orderPointCurrentPage" (click)="loadOrderPointPage(page)">{{ page + 1 }}</a></li>
                        }
                        <li><a href="javascript:void(0);" (click)="loadOrderPointPage(orderPointCurrentPage + 1)" [class.disabled]="orderPointCurrentPage >= orderPointTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
                      }
                    </ul>
                    <div class="custom-select page-size-select-custom" [class.open]="orderPointPageSizeDropdownOpen" (click)="toggleOrderPointPageSizeDropdown(); $event.stopPropagation()">
                      <div class="custom-select-trigger">
                        <span class="selected-value">{{ orderPointPageSize }}</span>
                        <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      @if (orderPointPageSizeDropdownOpen) {
                        <div class="custom-select-options open-upward square">
                          @for (size of pageSizeOptions; track size) {
                            <div class="custom-select-option" [class.selected]="orderPointPageSize === size" (click)="selectOrderPointPageSize(size); $event.stopPropagation()">
                              <span class="option-text">{{ size }}</span>
                              @if (orderPointPageSize === size) {
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
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
    
    <!-- Multiple Order Points Modal -->
    @if (showMultipleModal) {
      <div class="modal-overlay" (mousedown)="closeMultipleModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ 'ORDER_POINTS.ADD_MULTIPLE' | translate }}</h3>
            <button class="close-btn" (click)="closeMultipleModal()" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="multipleCount">{{ 'ORDER_POINTS.COUNT' | translate }}</label>
              <input type="number" id="multipleCount" class="form-control" min="1" [(ngModel)]="multipleForm.count">
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="multipleForm.payLater">
                <span class="checkbox-text">{{ 'ORDER_POINTS.PAY_LATER' | translate }}</span>
              </label>
            </div>
            <div class="form-group">
              <label for="multipleMenu">Menu</label>
              <select id="multipleMenu" class="form-control" [(ngModel)]="multipleForm.menuId">
                <option value="">-</option>
                @for (menu of menus; track menu.id) {
                  <option [value]="menu.id">{{ menu.name }}</option>
                }
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeMultipleModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveMultiple()" [disabled]="!multipleForm.count || multipleForm.count < 1 || savingMultiple">
              {{ savingMultiple ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }
    
    <!-- Location Modal -->
    @if (showLocationModal) {
      <div class="modal-overlay" (mousedown)="closeLocationModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingLocation ? ('LOCATIONS.EDIT_LOCATION' | translate) : (parentLocationForModal ? ('LOCATIONS.ADD_SUBLOCATION' | translate) : ('LOCATIONS.ADD_LOCATION' | translate)) }}</h3>
            <button class="close-btn" (click)="closeLocationModal()" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-body">
            @if (parentLocationForModal) {
              <div class="form-group">
                <label>{{ 'LOCATIONS.PARENT_LOCATION' | translate }}</label>
                <div class="parent-location-info">{{ parentLocationForModal.name }}</div>
              </div>
            }
            <div class="form-group">
              <label for="locationName">{{ parentLocationForModal ? ('LOCATIONS.SUBLOCATION_NAME' | translate) : ('LOCATIONS.LOCATION_NAME' | translate) }}</label>
              <input type="text" id="locationName" class="form-control" [(ngModel)]="locationForm.name" [placeholder]="'LOCATIONS.ENTER_NAME' | translate">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeLocationModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveLocation()" [disabled]="!locationForm.name || savingLocation">
              {{ savingLocation ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
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
      border-radius: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: visible;
    }
    .card-body {
      padding: 24px;
      overflow: visible;
    }
    .card-body.p-0 { padding: 0 !important; }
    .client-selector {
      max-width: 500px;
    }
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
      border-radius: 0;
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
      border-radius: 0;
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
      justify-content: flex-end;
      gap: 16px;
      width: 100%;
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
      border-radius: 0;
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

    /* Custom Select - square variant for page size */
    .custom-select { position: relative; cursor: pointer; }
    .custom-select-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 0;
      font-size: 14px;
      color: var(--text-dark);
      transition: all 0.2s ease;
      gap: 8px;
    }
    .custom-select:hover .custom-select-trigger { border-color: #cbd5e1; }
    .custom-select.open .custom-select-trigger { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .custom-select .selected-value { display: flex; align-items: center; gap: 8px; }
    .custom-select .dropdown-arrow { width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.2s ease; flex-shrink: 0; }
    .custom-select.open .dropdown-arrow { transform: rotate(180deg); }
    .custom-select-options {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 0;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
      z-index: 1100;
      overflow: hidden;
    }
    .custom-select-options.open-upward { top: auto; bottom: calc(100% + 4px); }
    .custom-select-options.square,
    .custom-select-options.square .custom-select-option,
    .custom-select-options.square .custom-select-option:first-child,
    .custom-select-options.square .custom-select-option:last-child,
    .custom-select-options.square .custom-select-option:only-child { border-radius: 0; }
    .custom-select-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 14px; color: var(--text-dark); cursor: pointer; transition: background 0.15s ease; }
    .custom-select-option:hover { background: var(--bg-light); }
    .custom-select-option.selected { background: rgba(59, 130, 246, 0.08); color: var(--primary); font-weight: 500; }
    .custom-select-option .option-text { flex: 1; }
    .custom-select-option .check-icon { width: 16px; height: 16px; color: var(--primary); margin-left: auto; }

    .custom-select.page-size-select-custom { width: auto; min-width: 72px; flex: 0 0 auto; }
    .custom-select.page-size-select-custom .custom-select-trigger { padding: 6px 10px; font-size: 13px; }
    .custom-select.page-size-select-custom .selected-value { font-weight: 400; }
    .custom-select.page-size-select-custom .custom-select-options { min-width: 100%; width: auto; }

    /* Button Styles */
    .btn-icon-action {
      width: 32px;
      height: 32px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: transparent;
      border-radius: 0;
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
      width: 34px;
      height: 34px;
      border-radius: 0;
    }
    .btn-icon-action-sm svg {
      width: 17px;
      height: 17px;
    }
    .btn-icon-add {
      background: transparent;
      border-color: rgba(0, 0, 0, 0.08);
      color: #64748b;
      border-radius: 0;
    }
    .btn-icon-add:hover {
      background: rgba(0, 0, 0, 0.04);
      border-color: rgba(0, 0, 0, 0.08);
      color: #374151;
    }
    .action-buttons {
      display: inline-flex;
      gap: 5px;
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
      border-radius: 0;
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
      border: 1px solid var(--border-color);
      background: transparent;
      border-radius: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      padding: 0;
    }
    .close-btn:hover {
      background: transparent;
      color: #374151;
      border-color: #cbd5e1;
    }
    .close-btn svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    .modal-body {
      padding: 20px;
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
      border-radius: 0;
      font-size: 14px;
      color: #374151;
      transition: border-color 0.15s ease;
    }
    .form-control:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .parent-location-info {
      padding: 10px 14px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 14px;
      color: #64748b;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 0;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-secondary {
      background: white;
      border: 1px solid var(--border-color);
      color: #64748b;
    }
    .btn-secondary:hover {
      background: white;
      color: #374151;
      border-color: #cbd5e1;
    }
    .btn-primary {
      background: white;
      border: 1px solid var(--primary);
      color: var(--primary);
    }
    .btn-primary:hover {
      background: var(--primary-light);
      border-color: var(--primary);
      color: var(--primary);
    }
    .btn-primary:disabled {
      background: white;
      border-color: #94a3b8;
      color: #94a3b8;
      cursor: not-allowed;
    }

    /* Checkbox Styles */
    .checkbox-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
    }
    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #3b82f6;
      cursor: pointer;
      flex-shrink: 0;
      margin: 0;
      margin-right: 5px;
    }
    .checkbox-text {
      user-select: none;
      position: relative;
      top: -2px;
    }

    /* Table Checkbox */
    .table-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      border-radius: 0;
      -webkit-appearance: none;
      appearance: none;
      border: 1px solid #cbd5e1;
      background: white;
      display: inline-grid;
      place-content: center;
      margin: 0;
    }
    .table-checkbox:checked {
      background: white;
      border-color: #cbd5e1;
    }
    .table-checkbox:checked::before {
      content: '';
      width: 10px;
      height: 10px;
      background: #475569;
      clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
    }
    .col-pay-later {
      width: 100px;
    }
    .col-actions {
      width: 92px;
    }
    .row-actions {
      display: inline-flex;
      gap: 4px;
      justify-content: flex-end;
    }
    .btn-icon-split {
      color: var(--primary);
      border-radius: 0;
    }
    .btn-icon-split:hover {
      background: rgba(59, 130, 246, 0.08);
      color: var(--primary);
    }
    .btn-icon-delete {
      color: var(--danger);
      border-radius: 0;
    }
    .btn-icon-delete:hover {
      background: rgba(253, 106, 106, 0.1);
      color: var(--danger);
    }

    /* Menu Column */
    .col-menu {
      width: 180px;
    }
    .menu-select {
      width: 100%;
      height: 32px;
      padding: 0 8px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 0;
      font-size: 13px;
      color: #64748b;
      background: transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
      background-size: 14px;
      padding-right: 24px;
    }
    .menu-select:hover {
      background-color: rgba(0, 0, 0, 0.04);
      color: #374151;
    }
    .menu-select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--primary-light);
    }

    /* Inline Name Input */
    .inline-name-input {
      border: 1px solid transparent;
      background: transparent;
      padding: 10px 12px;
      border-radius: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-dark);
      width: 100%;
      transition: all 0.15s ease;
    }
    .inline-name-input:hover {
      border-color: rgba(0, 0, 0, 0.08);
      background: rgba(0, 0, 0, 0.02);
    }
    .inline-name-input:focus {
      outline: none;
      border-color: var(--primary);
      background: white;
      box-shadow: 0 0 0 2px var(--primary-light);
    }
  `]
})
export class LocationsComponent implements OnInit {
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

  // Order Points
  orderPoints: OrderPoint[] = [];
  loadingOrderPoints = false;
  orderPointCurrentPage = 0;
  orderPointTotalPages = 0;
  orderPointPageSize = 20;
  orderPointPageSizeDropdownOpen = false;
  pageSizeOptions = [5, 10, 20, 50];

  // Menus for selected location
  menus: Menu[] = [];

  // Location Modal
  showLocationModal = false;
  editingLocation: Location | null = null;
  parentLocationForModal: Location | null = null;
  locationForm = { name: '' };
  savingLocation = false;

  // Add Order Point modal
  showMultipleModal = false;
  multipleForm: { count: number; payLater: boolean; menuId: string } = { count: 1, payLater: false, menuId: '' };
  savingMultiple = false;


  private searchSubject = new Subject<string>();

  constructor(
    private clientService: ClientService,
    private locationService: LocationService,
    private orderPointService: OrderPointService,
    private menuService: MenuService,
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
    const pageSizeSelect = this.elementRef.nativeElement.querySelector('.page-size-select-custom');
    if (pageSizeSelect && !pageSizeSelect.contains(event.target)) {
      this.orderPointPageSizeDropdownOpen = false;
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
      // SUPER users can see all clients
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
      // Non-SUPER users can only see their own client
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
    this.orderPoints = [];
    this.loadLocations();
  }

  // Location Methods
  loadLocations(): void {
    if (!this.selectedClient?.id) return;

    this.loadingLocations = true;
    this.locationService.getLocationsByClientId(this.selectedClient.id, this.locationCurrentPage, this.locationPageSize).subscribe({
      next: (response) => {
        // Sort to show parent locations first, then sublocations
        const parents = response.content.filter(l => !l.parentId);
        const children = response.content.filter(l => l.parentId);

        // Sort children under their parents
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
    this.orderPointCurrentPage = 0;
    this.loadMenus();
    this.loadOrderPoints();
  }

  // Order Point Methods
  loadOrderPoints(): void {
    if (!this.selectedLocation?.id) return;

    this.loadingOrderPoints = true;
    this.orderPointService.getOrderPointsByLocationId(this.selectedLocation.id, this.orderPointCurrentPage, this.orderPointPageSize).subscribe({
      next: (response) => {
        this.orderPoints = response.content;
        this.orderPointTotalPages = response.totalPages;
        this.loadingOrderPoints = false;
      },
      error: (err) => {
        console.error('Error loading order points:', err);
        this.orderPoints = [];
        this.loadingOrderPoints = false;
      }
    });
  }

  loadOrderPointPage(page: number): void {
    if (page < 0 || page >= this.orderPointTotalPages) return;
    this.orderPointCurrentPage = page;
    this.loadOrderPoints();
  }

  onOrderPointPageSizeChange(size: number): void {
    this.orderPointPageSize = +size;
    this.orderPointCurrentPage = 0;
    this.loadOrderPoints();
  }

  toggleOrderPointPageSizeDropdown(): void {
    this.orderPointPageSizeDropdownOpen = !this.orderPointPageSizeDropdownOpen;
  }

  selectOrderPointPageSize(size: number): void {
    this.orderPointPageSizeDropdownOpen = false;
    this.onOrderPointPageSizeChange(size);
  }

  loadMenus(): void {
    if (!this.selectedLocation?.id) return;
    this.menuService.getMenusByLocation(this.selectedLocation.id).subscribe({
      next: (menus) => {
        this.menus = menus;
      },
      error: () => {
        this.menus = [];
      }
    });
  }

  onMenuChange(orderPoint: OrderPoint, menuId: string): void {
    if (!orderPoint.id || !this.selectedLocation?.id) return;
    const newMenuId = menuId || undefined;
    this.orderPointService.updateOrderPoint(
      orderPoint.id,
      orderPoint.name,
      this.selectedLocation.id,
      orderPoint.payLater,
      newMenuId
    ).subscribe({
      next: () => {
        orderPoint.menuId = newMenuId;
      },
      error: (err) => {
        console.error('Error updating menu:', err);
      }
    });
  }

  onNameChange(orderPoint: OrderPoint, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();
    if (!orderPoint.id || !this.selectedLocation?.id || !newName || newName === orderPoint.name) return;

    this.orderPointService.updateOrderPoint(
      orderPoint.id,
      newName,
      this.selectedLocation.id,
      orderPoint.payLater,
      orderPoint.menuId
    ).subscribe({
      next: () => {
        orderPoint.name = newName;
      },
      error: (err) => {
        console.error('Error updating name:', err);
        input.value = orderPoint.name; // Revert on error
      }
    });
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

  // Location Modal Methods
  openLocationModal(): void {
    this.editingLocation = null;
    this.parentLocationForModal = null;
    this.locationForm = { name: '' };
    this.showLocationModal = true;
  }

  openSubLocationModal(parentLocation: Location): void {
    this.editingLocation = null;
    this.parentLocationForModal = parentLocation;
    this.locationForm = { name: '' };
    this.showLocationModal = true;
  }

  editLocation(location: Location): void {
    this.editingLocation = location;
    this.parentLocationForModal = location.parentId ? { id: location.parentId, name: location.parentName || '', clientId: location.clientId } : null;
    this.locationForm = { name: location.name };
    this.showLocationModal = true;
  }

  closeLocationModal(): void {
    this.showLocationModal = false;
    this.editingLocation = null;
    this.parentLocationForModal = null;
    this.locationForm = { name: '' };
  }

  saveLocation(): void {
    if (!this.locationForm.name || !this.selectedClient?.id) return;

    this.savingLocation = true;

    if (this.editingLocation) {
      this.locationService.updateLocation(
        this.editingLocation.id!,
        this.locationForm.name,
        this.selectedClient.id,
        this.editingLocation.parentId
      ).subscribe({
        next: () => {
          this.savingLocation = false;
          this.closeLocationModal();
          this.loadLocations();
        },
        error: (err) => {
          console.error('Error updating location:', err);
          this.savingLocation = false;
        }
      });
    } else {
      this.locationService.createLocation(
        this.selectedClient.id,
        this.locationForm.name,
        this.parentLocationForModal?.id
      ).subscribe({
        next: () => {
          this.savingLocation = false;
          this.closeLocationModal();
          this.loadLocations();
        },
        error: (err) => {
          console.error('Error creating location:', err);
          this.savingLocation = false;
        }
      });
    }
  }

  togglePayLater(orderPoint: OrderPoint, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (!orderPoint.id || !this.selectedLocation?.id) {
      // Revert checkbox state
      checkbox.checked = orderPoint.payLater;
      return;
    }

    const newValue = !orderPoint.payLater;
    this.orderPointService.updateOrderPoint(
      orderPoint.id,
      orderPoint.name,
      this.selectedLocation.id,
      newValue,
      orderPoint.menuId
    ).subscribe({
      next: () => {
        orderPoint.payLater = newValue;
      },
      error: (err) => {
        console.error('Error updating pay later:', err);
        // Revert checkbox state on error
        checkbox.checked = orderPoint.payLater;
      }
    });
  }

  splitOrderPoint(orderPoint: OrderPoint): void {
    if (!orderPoint.id || !orderPoint.payLater) return;
    this.orderPointService.splitOrderPoint(orderPoint.id).subscribe({
      next: () => {
        this.loadOrderPoints();
      },
      error: (err) => {
        console.error('Error splitting order point:', err);
      }
    });
  }

  deleteOrderPoint(orderPoint: OrderPoint): void {
    if (!orderPoint.id) return;
    if (!confirm(`Delete order point "${orderPoint.name}"?`)) return;

    this.orderPointService.deleteOrderPoint(orderPoint.id).subscribe({
      next: () => {
        this.loadOrderPoints();
      },
      error: (err) => {
        console.error('Error deleting order point:', err);
        alert('Could not delete this order point. It may be referenced by orders or registrations.');
      }
    });
  }

  // Add Order Point modal
  openMultipleModal(): void {
    if (!this.selectedLocation) return;
    this.multipleForm = { count: 1, payLater: false, menuId: '' };
    this.showMultipleModal = true;
  }

  closeMultipleModal(): void {
    this.showMultipleModal = false;
    this.savingMultiple = false;
  }

  saveMultiple(): void {
    if (!this.selectedLocation?.id) return;
    const count = Number(this.multipleForm.count);
    if (!Number.isInteger(count) || count < 1) return;

    this.savingMultiple = true;
    this.orderPointService.createOrderPointsBatch(
      this.selectedLocation.id,
      count,
      this.multipleForm.payLater,
      this.multipleForm.menuId || undefined
    ).subscribe({
      next: () => {
        this.savingMultiple = false;
        this.closeMultipleModal();
        this.loadOrderPoints();
      },
      error: (err) => {
        console.error('Error creating order points:', err);
        this.savingMultiple = false;
      }
    });
  }
}