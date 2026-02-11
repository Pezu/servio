import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ClientService, Client } from '../clients/client.service';
import { LocationService, Location } from '../clients/location.service';
import { OrderPointService, OrderPoint } from '../clients/order-point.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-locations',
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
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
              <button class="btn-icon-action btn-icon-add" (click)="openOrderPointModal()" [disabled]="!selectedLocation" [title]="'ORDER_POINTS.ADD_ORDER_POINT' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <tbody>
                    @if (!selectedLocation) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'ORDER_POINTS.SELECT_LOCATION' | translate }}</td></tr>
                    } @else if (loadingOrderPoints) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                    } @else if (orderPoints.length === 0) {
                      <tr><td colspan="2" class="text-center py-4 text-muted">{{ 'ORDER_POINTS.NO_ORDER_POINTS' | translate }}</td></tr>
                    } @else {
                      @for (orderPoint of orderPoints; track orderPoint.id) {
                        <tr>
                          <td class="position-relative">
                            <div class="status-indicator border-success"></div>
                            <div class="d-flex align-items-center gap-3">
                              <div class="qr-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13 0h3v2h-3v-2zm-5-2h2v2h-2v-2zm2 4h2v2h-2v-2zm2-4h5v2h-5v-2zm3 4h2v5h-2v-5zm-3 2h2v3h-2v-3zm-2 3h2v2h-2v-2z"/>
                                </svg>
                              </div>
                              <div><a href="javascript:void(0);" class="d-block fw-semibold">{{ orderPoint.name }}</a></div>
                            </div>
                          </td>
                          <td class="text-end">
                            <button class="btn-icon-action btn-icon-action-sm" (click)="editOrderPoint(orderPoint)" [title]="'ORDER_POINTS.EDIT_ORDER_POINT' | translate">
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
            @if (orderPointTotalPages > 1) {
              <div class="card-footer">
                <div class="pagination-container">
                  <ul class="pagination-list">
                    <li><a href="javascript:void(0);" (click)="loadOrderPointPage(orderPointCurrentPage - 1)" [class.disabled]="orderPointCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
                    @for (page of getPageNumbers(orderPointTotalPages, orderPointCurrentPage); track page) {
                      <li><a href="javascript:void(0);" [class.active]="page === orderPointCurrentPage" (click)="loadOrderPointPage(page)">{{ page + 1 }}</a></li>
                    }
                    <li><a href="javascript:void(0);" (click)="loadOrderPointPage(orderPointCurrentPage + 1)" [class.disabled]="orderPointCurrentPage >= orderPointTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
                  </ul>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
    </div>

    <!-- Location Modal -->
    @if (showLocationModal) {
      <div class="modal-overlay" (mousedown)="closeLocationModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingLocation ? ('LOCATIONS.EDIT_LOCATION' | translate) : (parentLocationForModal ? ('LOCATIONS.ADD_SUBLOCATION' | translate) : ('LOCATIONS.ADD_LOCATION' | translate)) }}</h3>
            <button class="close-btn" (click)="closeLocationModal()" title="Close">&times;</button>
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

    <!-- Order Point Modal -->
    @if (showOrderPointModal) {
      <div class="modal-overlay" (mousedown)="closeOrderPointModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingOrderPoint ? ('ORDER_POINTS.EDIT_ORDER_POINT' | translate) : ('ORDER_POINTS.ADD_ORDER_POINT' | translate) }}</h3>
            <button class="close-btn" (click)="closeOrderPointModal()" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="orderPointName">{{ 'COMMON.NAME' | translate }}</label>
              <input type="text" id="orderPointName" class="form-control" [(ngModel)]="orderPointForm.name" [placeholder]="'ORDER_POINTS.ENTER_NAME' | translate">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeOrderPointModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveOrderPoint()" [disabled]="!orderPointForm.name || savingOrderPoint">
              {{ savingOrderPoint ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
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
    }
    .locations-panel {
      width: 40%;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .details-panel {
      width: 60%;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .card.stretch {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
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

    /* Order Point Row */
    .position-relative { position: relative; }
    .status-indicator {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 36px;
      border-radius: 0 4px 4px 0;
    }
    .status-indicator.border-success { background: var(--success); }
    .d-flex { display: flex; }
    .align-items-center { align-items: center; }
    .gap-3 { gap: 12px; }
    .d-block { display: block; }
    .qr-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
    }
    .qr-icon svg {
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
    .parent-location-info {
      padding: 10px 14px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 14px;
      color: #64748b;
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

  // Location Modal
  showLocationModal = false;
  editingLocation: Location | null = null;
  parentLocationForModal: Location | null = null;
  locationForm = { name: '' };
  savingLocation = false;

  // Order Point Modal
  showOrderPointModal = false;
  editingOrderPoint: OrderPoint | null = null;
  orderPointForm = { name: '' };
  savingOrderPoint = false;

  private searchSubject = new Subject<string>();

  constructor(
    private clientService: ClientService,
    private locationService: LocationService,
    private orderPointService: OrderPointService,
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

  // Order Point Modal Methods
  openOrderPointModal(): void {
    if (!this.selectedLocation) return;
    this.editingOrderPoint = null;
    this.orderPointForm = { name: '' };
    this.showOrderPointModal = true;
  }

  editOrderPoint(orderPoint: OrderPoint): void {
    this.editingOrderPoint = orderPoint;
    this.orderPointForm = { name: orderPoint.name };
    this.showOrderPointModal = true;
  }

  closeOrderPointModal(): void {
    this.showOrderPointModal = false;
    this.editingOrderPoint = null;
    this.orderPointForm = { name: '' };
  }

  saveOrderPoint(): void {
    if (!this.orderPointForm.name || !this.selectedLocation?.id) return;

    this.savingOrderPoint = true;

    if (this.editingOrderPoint) {
      this.orderPointService.updateOrderPoint(
        this.editingOrderPoint.id!,
        this.orderPointForm.name,
        this.selectedLocation.id
      ).subscribe({
        next: () => {
          this.savingOrderPoint = false;
          this.closeOrderPointModal();
          this.loadOrderPoints();
        },
        error: (err) => {
          console.error('Error updating order point:', err);
          this.savingOrderPoint = false;
        }
      });
    } else {
      this.orderPointService.createOrderPoint(
        this.selectedLocation.id,
        this.orderPointForm.name
      ).subscribe({
        next: () => {
          this.savingOrderPoint = false;
          this.closeOrderPointModal();
          this.loadOrderPoints();
        },
        error: (err) => {
          console.error('Error creating order point:', err);
          this.savingOrderPoint = false;
        }
      });
    }
  }
}