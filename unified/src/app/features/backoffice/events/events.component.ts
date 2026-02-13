import { Component, OnInit, HostListener, ElementRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

// Custom date adapter for dd-MM-yyyy format
class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'input') {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return date.toDateString();
  }

  override parse(value: any): Date | null {
    if (typeof value === 'string' && value.includes('-')) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    return super.parse(value);
  }
}

const CUSTOM_DATE_FORMATS = {
  parse: { dateInput: 'input' },
  display: {
    dateInput: 'input',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' }
  }
};
import { ClientService, Client, PageResponse } from '../clients/client.service';
import { LocationService, Location } from '../clients/location.service';
import { EventService, Event } from '../clients/event.service';
import { UserService, User } from '../clients/user.service';
import { PaymentTypeService, PaymentType } from '../configuration/payment-types/payment-type.service';
import { MenuService, MenuItem } from '../clients/menu.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatDatepickerModule, MatInputModule, MatFormFieldModule],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS }
  ],
  template: `
    <div class="page-container">
      <!-- Selectors Row -->
      <div class="selectors-row">
        <!-- Client Selector -->
        <div class="client-selector-container">
          <label class="selector-label">{{ 'CLIENTS.TITLE' | translate }}</label>
          <div class="selector-wrapper" [class.open]="clientDropdownOpen">
            <div class="selector-input" (click)="toggleClientDropdown()">
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

            <div class="selector-dropdown" *ngIf="clientDropdownOpen">
              <div class="search-box">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="search-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" class="search-input" [placeholder]="'COMMON.SEARCH' | translate"
                       [(ngModel)]="clientSearchTerm" (input)="onClientSearch()" (click)="$event.stopPropagation()">
              </div>
              <div class="client-list">
                <div *ngIf="loadingClients" class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                <div *ngIf="!loadingClients && clients.length === 0" class="empty-state">{{ 'CLIENTS.NO_CLIENTS' | translate }}</div>
                <div *ngFor="let client of clients" class="client-option"
                     [class.selected]="selectedClient?.id === client.id" (click)="selectClient(client)">
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

        <!-- Location Selector -->
        @if (selectedClient) {
          <div class="location-selector-container">
            <label class="selector-label">{{ 'LOCATIONS.LOCATION' | translate }}</label>
            <div class="selector-wrapper location-wrapper" [class.open]="locationDropdownOpen">
              <div class="selector-input" (click)="toggleLocationDropdown()">
                <div class="selected-location" *ngIf="selectedLocation">
                  <svg class="location-pin-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="location-name">{{ selectedLocation.name }}</span>
                </div>
                <div class="placeholder" *ngIf="!selectedLocation">
                  {{ 'MENU.SELECT_LOCATION' | translate }}
                </div>
                <span class="dropdown-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>

              <div class="selector-dropdown" *ngIf="locationDropdownOpen">
                <div class="search-box">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="search-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" class="search-input" [placeholder]="'COMMON.SEARCH' | translate"
                         [(ngModel)]="locationSearchTerm" (input)="onLocationSearch()" (click)="$event.stopPropagation()">
                </div>
                <div class="location-list">
                  <div *ngIf="loadingLocations" class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                  <div *ngIf="!loadingLocations && filteredLocations.length === 0" class="empty-state">{{ 'LOCATIONS.NO_LOCATIONS' | translate }}</div>
                  <div *ngFor="let location of filteredLocations" class="location-option"
                       [class.selected]="selectedLocation?.id === location.id"
                       [class.sublocation]="location.parentId"
                       (click)="selectLocation(location)">
                    <svg class="location-pin-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span class="location-name">{{ location.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Events Table -->
      @if (selectedClient) {
        <div class="events-panel">
          <div class="card stretch">
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>
                        <div class="th-with-search">
                          <span>{{ 'EVENTS.TITLE' | translate }}</span>
                          <div class="search-input-wrapper">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="search-icon">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input type="text" class="search-input" [placeholder]="'COMMON.SEARCH' | translate" [(ngModel)]="eventSearchTerm" (input)="onEventSearch()">
                          </div>
                        </div>
                      </th>
                      <th>{{ 'EVENTS.START_DATE' | translate }}</th>
                      <th>{{ 'EVENTS.END_DATE' | translate }}</th>
                      <th class="text-end">
                        @if (selectedLocation) {
                          <button class="btn-icon-action btn-icon-add" (click)="openEventModal(); $event.stopPropagation()" [title]="'EVENTS.ADD_EVENT' | translate">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        }
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @if (loadingEvents) {
                      <tr><td colspan="4" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                    } @else if (events.length === 0) {
                      <tr><td colspan="4" class="text-center py-4 text-muted">{{ 'EVENTS.NO_EVENTS' | translate }}</td></tr>
                    } @else {
                      @for (event of events; track event.id) {
                        <tr>
                          <td class="position-relative">
                            <div class="status-indicator" [class.border-success]="isEventInProgress(event)" [class.border-danger]="!isEventInProgress(event)"></div>
                            <div class="d-flex align-items-center gap-3">
                              @if (event.logoPath) {
                                <img [src]="eventService.getLogoUrl(event.logoPath)" class="event-logo" alt="">
                              } @else {
                                <div class="avatar-icon" [class.avatar-icon-success]="isEventInProgress(event)" [class.avatar-icon-danger]="!isEventInProgress(event)">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              }
                              <div><a href="javascript:void(0);" class="d-block fw-semibold">{{ event.name }}</a></div>
                            </div>
                          </td>
                          <td class="text-muted">{{ formatDate(event.startDate) }}</td>
                          <td class="text-muted">{{ formatDate(event.endDate) }}</td>
                          <td class="text-end">
                            <label class="btn-icon-action" [title]="'EVENTS.UPLOAD_LOGO' | translate">
                              <input type="file" accept="image/*" (change)="uploadLogo($event, event)" hidden>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </label>
                            @if (event.logoPath) {
                              <button class="btn-icon-action btn-icon-delete" (click)="deleteLogo(event)" [title]="'EVENTS.DELETE_LOGO' | translate">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            }
                            <button class="btn-icon-action" (click)="downloadQrPdf(event.id!)" [title]="'EVENTS.DOWNLOAD_QR' | translate">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                              </svg>
                            </button>
                            <button class="btn-icon-action" (click)="editEvent(event)" [title]="'COMMON.EDIT' | translate">
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
                  <li><a href="javascript:void(0);" (click)="loadEventPage(eventCurrentPage - 1)" [class.disabled]="eventCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
                  @for (page of getPageNumbers(eventTotalPages, eventCurrentPage); track page) {
                    <li><a href="javascript:void(0);" [class.active]="page === eventCurrentPage" (click)="loadEventPage(page)">{{ page + 1 }}</a></li>
                  }
                  <li><a href="javascript:void(0);" (click)="loadEventPage(eventCurrentPage + 1)" [class.disabled]="eventCurrentPage >= eventTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
                </ul>
                <select class="page-size-select" [ngModel]="eventPageSize" (ngModelChange)="onEventPageSizeChange($event)">
                  @for (size of pageSizeOptions; track size) {
                    <option [value]="size">{{ size }}</option>
                  }
                </select>
              </div>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Event Modal -->
    @if (showEventModal) {
      <div class="modal-overlay" (mousedown)="closeEventModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingEvent ? ('COMMON.EDIT' | translate) : ('COMMON.ADD' | translate) }} {{ 'EVENTS.EVENT' | translate }}</h3>
            <button class="close-btn" (click)="closeEventModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ 'COMMON.NAME' | translate }}</label>
              <input type="text" class="form-control" [(ngModel)]="eventFormData.name" [placeholder]="'COMMON.NAME' | translate">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>{{ 'EVENTS.START_DATE' | translate }}</label>
                <mat-form-field class="date-field" appearance="outline">
                  <input matInput [matDatepicker]="startPicker" [(ngModel)]="startDate" placeholder="Select date">
                  <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
                  <mat-datepicker #startPicker></mat-datepicker>
                </mat-form-field>
              </div>
              <div class="form-group">
                <label>{{ 'EVENTS.END_DATE' | translate }}</label>
                <mat-form-field class="date-field" appearance="outline">
                  <input matInput [matDatepicker]="endPicker" [(ngModel)]="endDate" placeholder="Select date">
                  <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
                  <mat-datepicker #endPicker></mat-datepicker>
                </mat-form-field>
              </div>
            </div>

            <!-- Users Selection -->
            <div class="form-group">
              <label>{{ 'EVENTS.BAR_USERS' | translate }}</label>
              <div class="multi-select-wrapper users-dropdown" [class.open]="usersDropdownOpen">
                <div class="multi-select-input" (click)="toggleUsersDropdown(); $event.stopPropagation()">
                  <span class="selected-text" *ngIf="getSelectedUsersText()">{{ getSelectedUsersText() }}</span>
                  <span class="placeholder" *ngIf="!getSelectedUsersText()">{{ 'EVENTS.SELECT_USERS' | translate }}</span>
                  <span class="dropdown-arrow">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
                <div class="multi-select-dropdown" *ngIf="usersDropdownOpen" (click)="$event.stopPropagation()">
                  <div *ngIf="loadingUsers" class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                  <div *ngIf="!loadingUsers && getBarUsers().length === 0" class="empty-state">{{ 'USERS.NO_USERS' | translate }}</div>
                  <label *ngFor="let user of getBarUsers()" class="checkbox-option">
                    <input type="checkbox" [checked]="eventFormData.userIds.includes(user.id!)" (change)="toggleEventUser(user.id!, $event)">
                    <span class="checkbox-label-text">{{ user.name }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Payment Types Selection -->
            <div class="form-group">
              <label>{{ 'EVENTS.PAYMENT_TYPES' | translate }}</label>
              <div class="multi-select-wrapper payment-types-dropdown" [class.open]="paymentTypesDropdownOpen">
                <div class="multi-select-input" (click)="togglePaymentTypesDropdown(); $event.stopPropagation()">
                  <span class="selected-text" *ngIf="getSelectedPaymentTypesText()">{{ getSelectedPaymentTypesText() }}</span>
                  <span class="placeholder" *ngIf="!getSelectedPaymentTypesText()">{{ 'EVENTS.SELECT_PAYMENT_TYPES' | translate }}</span>
                  <span class="dropdown-arrow">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
                <div class="multi-select-dropdown open-upward" *ngIf="paymentTypesDropdownOpen" (click)="$event.stopPropagation()">
                  <div *ngIf="loadingPaymentTypes" class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                  <div *ngIf="!loadingPaymentTypes && paymentTypes.length === 0" class="empty-state">{{ 'PAYMENT_TYPES.NO_PAYMENT_TYPES' | translate }}</div>
                  <label *ngFor="let pt of paymentTypes" class="checkbox-option">
                    <input type="checkbox" [checked]="eventFormData.paymentTypeIds.includes(pt.id!)" (change)="togglePaymentType(pt.id!, $event)">
                    <span class="checkbox-label-text">{{ pt.name }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Menu Source Switch -->
            <div class="form-group">
              <label>{{ 'EVENTS.MENU_SOURCE' | translate }}</label>
              <div class="menu-source-switch">
                <button type="button" class="switch-option" [class.active]="eventFormData.menuSource === 'client'" (click)="eventFormData.menuSource = 'client'">
                  {{ 'EVENTS.MENU_CLIENT' | translate }}
                </button>
                <button type="button" class="switch-option" [class.active]="eventFormData.menuSource === 'location'" (click)="eventFormData.menuSource = 'location'">
                  {{ 'EVENTS.MENU_LOCATION' | translate }}
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeEventModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveEvent()" [disabled]="!eventFormData.name.trim() || savingEvent">
              {{ savingEvent ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
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

    .page-container { display: flex; flex-direction: column; height: 100%; min-height: 0; }

    /* Selectors Row */
    .selectors-row { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }

    .client-selector-container, .location-selector-container { display: flex; align-items: center; gap: 12px; }
    .selector-label { font-size: 14px; font-weight: 500; color: #374151; white-space: nowrap; }
    .selector-wrapper { position: relative; min-width: 300px; }
    .location-wrapper { min-width: 280px; }
    .selector-input { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s ease; }
    .selector-input:hover { border-color: #cbd5e1; }
    .selector-wrapper.open .selector-input { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .selected-client, .selected-location { display: flex; align-items: center; gap: 8px; }
    .placeholder { color: #94a3b8; }
    .dropdown-arrow { display: flex; align-items: center; color: #94a3b8; transition: transform 0.2s ease; }
    .dropdown-arrow svg { width: 18px; height: 18px; }
    .selector-wrapper.open .dropdown-arrow { transform: rotate(180deg); }
    .selector-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100; max-height: 350px; display: flex; flex-direction: column; }
    .search-box { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #e2e8f0; gap: 8px; }
    .search-icon { width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; }
    .search-input { flex: 1; border: none; outline: none; font-size: 14px; color: #374151; background: transparent; }
    .search-input::placeholder { color: #94a3b8; }
    .client-list, .location-list { overflow-y: auto; max-height: 280px; }
    .loading-state, .empty-state { padding: 20px; text-align: center; color: #94a3b8; font-size: 14px; }
    .client-option, .location-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s ease; }
    .client-option:hover, .location-option:hover { background: #f8fafc; }
    .client-option.selected, .location-option.selected { background: #eff6ff; }
    .location-option.sublocation { padding-left: 32px; }
    .client-info { display: flex; flex-direction: column; gap: 2px; }
    .client-name, .location-name { font-size: 14px; font-weight: 500; color: #1e293b; }
    .client-details { font-size: 12px; color: var(--text-muted); }
    .status-bullet { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .bg-success { background-color: var(--success); }
    .bg-danger { background-color: var(--danger); }
    .location-pin-icon { width: 18px; height: 18px; color: var(--primary); flex-shrink: 0; }

    /* Events Panel */
    .events-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; }

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
    .table-hover tbody tr:hover { background: var(--bg-light); }
    .table.mb-0 { margin-bottom: 0; }
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .text-muted { color: var(--text-muted); }
    .py-4 { padding-top: 24px; padding-bottom: 24px; }

    .th-with-search { display: flex; align-items: center; gap: 12px; }
    .search-input-wrapper { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: white; }
    .search-input-wrapper .search-icon { width: 14px; height: 14px; }
    .search-input-wrapper .search-input { width: 120px; font-size: 13px; }

    .position-relative { position: relative; }
    .status-indicator { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
    .border-success { background-color: var(--success); }
    .border-danger { background-color: var(--danger); }

    .d-flex { display: flex; }
    .align-items-center { align-items: center; }
    .gap-3 { gap: 12px; }
    .d-block { display: block; }
    .fw-semibold { font-weight: 600; }

    .avatar-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .avatar-icon svg { width: 18px; height: 18px; }
    .avatar-icon-success { background: rgba(12, 175, 96, 0.1); color: var(--success); }
    .avatar-icon-danger { background: rgba(253, 106, 106, 0.1); color: var(--danger); }
    .event-logo { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }

    /* Buttons */
    .btn-icon-action { width: 32px; height: 32px; border: 1px solid rgba(0, 0, 0, 0.08); background: transparent; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #64748b; transition: all 0.15s ease; margin-left: 4px; }
    .btn-icon-action:hover { background: rgba(0, 0, 0, 0.04); color: #374151; }
    .btn-icon-action svg { width: 16px; height: 16px; }
    .btn-icon-add { background: var(--primary); border-color: var(--primary); color: white; }
    .btn-icon-add:hover { background: #2563eb; border-color: #2563eb; color: white; }
    .btn-icon-delete:hover { background: rgba(253, 106, 106, 0.1); color: var(--danger); border-color: rgba(253, 106, 106, 0.3); }
    label.btn-icon-action { cursor: pointer; }

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
    .modal { background: white; border-radius: 12px; width: 100%; max-width: 680px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15); max-height: 90vh; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
    .modal-header h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; }
    .close-btn { width: 32px; height: 32px; border: none; background: #f1f5f9; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 20px; }
    .close-btn:hover { background: #e2e8f0; color: #374151; }
    .modal-body { padding: 20px; overflow-y: auto; overflow-x: visible; flex: 1; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px; }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-dark); box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .form-row { display: flex; gap: 16px; }
    .form-row .form-group { flex: 1; }

    /* Multi-select */
    .multi-select-wrapper { position: relative; }
    .multi-select-input { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s ease; }
    .multi-select-input:hover { border-color: #cbd5e1; }
    .multi-select-wrapper.open .multi-select-input { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .selected-text { font-size: 14px; color: var(--text-dark); }
    .multi-select-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 1100; max-height: 200px; overflow-y: auto; }
    .multi-select-dropdown.open-upward { top: auto; bottom: calc(100% + 4px); }
    .checkbox-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s ease; }
    .checkbox-option:hover { background: var(--bg-light); }
    .checkbox-option input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; }
    .checkbox-option span { font-size: 14px; color: var(--text-dark); }
    .checkbox-label-text { margin-left: 8px; }
    .checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: normal !important; }
    .checkbox-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }

    /* Menu Source Switch */
    .menu-source-switch { display: flex; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
    .switch-option { flex: 1; padding: 10px 16px; border: none; background: white; font-size: 14px; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: all 0.15s ease; }
    .switch-option:first-child { border-right: 1px solid var(--border-color); }
    .switch-option:hover:not(.active) { background: var(--bg-light); }
    .switch-option.active { background: var(--primary); color: white; }

    /* Custom DateTime Picker */
    .datetime-picker-wrapper { position: relative; }
    .datetime-input { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s ease; }
    .datetime-input:hover { border-color: #cbd5e1; }
    .datetime-picker-wrapper.open .datetime-input { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .datetime-picker-wrapper.open .dropdown-arrow { transform: rotate(180deg); }
    .calendar-icon { width: 18px; height: 18px; color: var(--text-muted); flex-shrink: 0; }
    .datetime-value { font-size: 14px; color: var(--text-dark); flex: 1; }
    .datetime-placeholder { font-size: 14px; color: #94a3b8; flex: 1; }
    .datetime-dropdown { position: absolute; top: calc(100% + 4px); left: 0; background: white; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 200; padding: 12px; min-width: 280px; }
    .calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .nav-btn { width: 28px; height: 28px; border: 1px solid var(--border-color); background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--text-muted); transition: all 0.15s ease; }
    .nav-btn:hover { background: var(--bg-light); color: var(--text-dark); }
    .month-year { font-size: 14px; font-weight: 600; color: var(--text-dark); }
    .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 8px; }
    .calendar-weekdays span { font-size: 11px; font-weight: 600; color: var(--text-muted); text-align: center; padding: 4px; text-transform: uppercase; }
    .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .calendar-day { font-size: 13px; color: var(--text-dark); text-align: center; padding: 8px 4px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
    .calendar-day:hover { background: var(--bg-light); }
    .calendar-day.other-month { color: #cbd5e1; }
    .calendar-day.today { font-weight: 600; color: var(--primary); }
    .calendar-day.selected { background: var(--primary); color: white; }
    .calendar-day.selected:hover { background: #2563eb; }
    .time-section { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); }
    .time-label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
    .time-select { padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 14px; color: var(--text-dark); background: white; cursor: pointer; min-width: 50px; }
    .time-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .time-separator { font-size: 14px; color: var(--text-muted); font-weight: 600; }

    /* Material Date Picker - Styled like regular form-control */
    .date-field { width: 100%; }
    .date-field .mat-mdc-form-field { width: 100%; }
    .date-field .mat-mdc-form-field-subscript-wrapper { display: none !important; }

    /* Hide ALL Material outline elements */
    .date-field .mdc-notched-outline,
    .date-field .mdc-notched-outline__leading,
    .date-field .mdc-notched-outline__notch,
    .date-field .mdc-notched-outline__trailing,
    .date-field .mdc-line-ripple { display: none !important; }

    /* Main wrapper styling */
    .date-field .mat-mdc-text-field-wrapper,
    .date-field .mdc-text-field,
    .date-field .mdc-text-field--outlined {
      background: white !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      padding: 0 8px 0 0 !important;
      height: 44px !important;
      transition: all 0.2s ease !important;
      overflow: hidden !important;
    }
    .date-field .mat-mdc-text-field-wrapper:hover,
    .date-field .mdc-text-field:hover { border-color: #cbd5e1 !important; }
    .date-field .mat-mdc-text-field-wrapper.mdc-text-field--focused,
    .date-field .mdc-text-field--focused {
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 3px #eff6ff !important;
    }

    /* Inner container */
    .date-field .mat-mdc-form-field-flex {
      height: 100% !important;
      align-items: center !important;
      background: transparent !important;
    }
    .date-field .mat-mdc-form-field-infix {
      padding: 0 !important;
      min-height: auto !important;
      width: 100% !important;
      border: none !important;
      background: transparent !important;
    }

    /* Input element */
    .date-field input,
    .date-field input.mat-mdc-input-element,
    .date-field .mdc-text-field__input {
      font-size: 14px !important;
      color: #1e293b !important;
      padding: 10px 14px !important;
      height: 100% !important;
      box-sizing: border-box !important;
      background: transparent !important;
      border: none !important;
      outline: none !important;
      caret-color: #3b82f6 !important;
    }
    .date-field input::placeholder,
    .date-field .mdc-text-field__input::placeholder { color: #94a3b8 !important; }

    /* Calendar toggle button */
    .date-field .mat-mdc-form-field-icon-suffix { padding: 0 4px 0 0 !important; }
    .date-field .mat-datepicker-toggle { color: #64748b !important; position: relative !important; top: -3px !important; }
    .date-field .mat-datepicker-toggle:hover { color: #374151 !important; }
    .date-field .mat-datepicker-toggle button {
      width: 32px !important;
      height: 32px !important;
      background: transparent !important;
    }

    /* Material Datepicker Calendar Popup - Duralux Style */
    .mat-datepicker-content {
      background-color: #ffffff !important;
      border-radius: 12px !important;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08) !important;
      border: 1px solid #e2e8f0 !important;
      overflow: visible !important;
    }
    .mat-datepicker-content .mat-calendar {
      background-color: #ffffff;
      font-family: inherit;
      width: 296px !important;
    }
    .mat-calendar-header {
      background: #f8fafc;
      padding: 12px 16px 8px !important;
      border-bottom: 1px solid #e2e8f0;
    }
    .mat-calendar-controls {
      margin: 0 !important;
    }
    .mat-calendar-period-button {
      font-size: 14px !important;
      font-weight: 600 !important;
      color: #1e293b !important;
      padding: 0 8px !important;
    }
    .mat-calendar-period-button:hover {
      background: #e2e8f0 !important;
    }
    .mat-calendar-arrow {
      fill: #64748b !important;
      margin-left: 6px !important;
    }
    .mat-calendar-previous-button,
    .mat-calendar-next-button {
      color: #64748b !important;
      border-radius: 8px !important;
    }
    .mat-calendar-previous-button:hover,
    .mat-calendar-next-button:hover {
      background: #e2e8f0 !important;
    }
    .mat-calendar-previous-button .mat-mdc-button-touch-target,
    .mat-calendar-next-button .mat-mdc-button-touch-target {
      height: 36px !important;
      width: 36px !important;
    }
    .mat-calendar-content {
      padding: 0 4px 8px !important;
      overflow: hidden !important;
    }
    .mat-calendar-table {
      width: 100% !important;
      border-spacing: 0 !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }
    .mat-calendar-table-header {
      background: transparent;
    }
    .mat-calendar-table-header th {
      font-size: 11px !important;
      font-weight: 600 !important;
      color: #94a3b8 !important;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 0 !important;
      width: 40px !important;
    }
    .mat-calendar-table-header th,
    .mat-calendar-table-header th:hover,
    .mat-calendar-table-header th *,
    .mat-calendar-table-header th *:hover,
    .mat-calendar-table-header th abbr,
    .mat-calendar-table-header th abbr:hover,
    .mat-calendar-table-header th span,
    .mat-calendar-table-header th span:hover {
      color: #94a3b8 !important;
      background: transparent !important;
      text-decoration: none !important;
      cursor: default !important;
      pointer-events: none !important;
    }
    .mat-calendar-table-header-divider {
      display: none !important;
    }
    .mat-calendar-body {
      font-size: 13px !important;
    }
    .mat-calendar-body-label {
      color: #64748b !important;
      font-weight: 500 !important;
      padding-top: 8px !important;
      padding-bottom: 8px !important;
    }
    .mat-calendar-body-cell {
      border-radius: 8px !important;
    }
    .mat-calendar-body-cell:hover:not(.mat-calendar-body-disabled) .mat-calendar-body-cell-content {
      background: #eff6ff !important;
    }
    .mat-calendar-body-cell-content {
      font-size: 13px !important;
      font-weight: 500 !important;
      color: #1e293b !important;
      border-radius: 8px !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      border: none !important;
      transition: background 0.15s ease !important;
    }
    .mat-calendar-body-disabled .mat-calendar-body-cell-content {
      color: #cbd5e1 !important;
    }
    .mat-calendar-body-selected {
      background-color: #3b82f6 !important;
      color: #ffffff !important;
    }
    .mat-calendar-body-selected:hover {
      background-color: #2563eb !important;
    }
    .mat-calendar-body-today:not(.mat-calendar-body-selected) {
      border: 2px solid #3b82f6 !important;
      background: transparent !important;
    }
    .mat-calendar-body-today:not(.mat-calendar-body-selected) .mat-calendar-body-cell-content {
      color: #3b82f6 !important;
      font-weight: 600 !important;
    }
    .mat-calendar-body-in-range::before {
      background: #eff6ff !important;
    }
    /* Year/Month selection view */
    .mat-calendar-body-cell-content.mat-calendar-body-selected {
      background-color: #3b82f6 !important;
      color: #ffffff !important;
    }
    .mat-datepicker-content .mat-mdc-button {
      border-radius: 8px !important;
    }
    .mat-datepicker-actions {
      padding: 12px 16px !important;
      border-top: 1px solid #e2e8f0 !important;
      background: #f8fafc !important;
    }
  `],
  encapsulation: ViewEncapsulation.None
})
export class EventsComponent implements OnInit {
  // Role-based access
  hasRoleSuper = false;
  userClientId: string | null = null;

  // Clients
  clients: Client[] = [];
  selectedClient: Client | null = null;
  clientSearchTerm = '';
  loadingClients = false;
  clientDropdownOpen = false;

  // Locations
  locations: Location[] = [];
  selectedLocation: Location | null = null;
  locationSearchTerm = '';
  loadingLocations = false;
  locationDropdownOpen = false;

  // Events
  events: Event[] = [];
  loadingEvents = false;
  savingEvent = false;
  showEventModal = false;
  editingEvent: Event | null = null;
  eventCurrentPage = 0;
  eventTotalPages = 0;
  eventPageSize = 10;
  eventSearchTerm = '';
  pageSizeOptions = [5, 10, 20, 50];
  eventFormData: { name: string; startDate: string; endDate: string; userIds: string[]; paymentTypeIds: string[]; menuSource: 'client' | 'location' } = {
    name: '', startDate: '', endDate: '', userIds: [], paymentTypeIds: [], menuSource: 'client'
  };

  // Users
  users: User[] = [];
  loadingUsers = false;
  usersDropdownOpen = false;

  // Payment Types
  paymentTypes: PaymentType[] = [];
  loadingPaymentTypes = false;
  paymentTypesDropdownOpen = false;

  // Menu Items for event
  eventMenuItems: MenuItem[] = [];

  // Material Date Picker
  startDate: Date | null = null;
  endDate: Date | null = null;

  private clientSearchSubject = new Subject<string>();

  constructor(
    private clientService: ClientService,
    private locationService: LocationService,
    public eventService: EventService,
    private userService: UserService,
    private paymentTypeService: PaymentTypeService,
    private menuService: MenuService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.initUserRoles();
    this.loadClients();
    this.clientSearchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(term => this.loadClients(term));
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
    const clientSelector = this.elementRef.nativeElement.querySelector('.client-selector-container .selector-wrapper');
    if (clientSelector && !clientSelector.contains(event.target)) {
      this.clientDropdownOpen = false;
    }
    const locationSelector = this.elementRef.nativeElement.querySelector('.location-selector-container .selector-wrapper');
    if (locationSelector && !locationSelector.contains(event.target)) {
      this.locationDropdownOpen = false;
    }
    // Close modal dropdowns when clicking outside
    const usersDropdown = this.elementRef.nativeElement.querySelector('.users-dropdown');
    if (usersDropdown && !usersDropdown.contains(event.target)) {
      this.usersDropdownOpen = false;
    }
    const paymentTypesDropdown = this.elementRef.nativeElement.querySelector('.payment-types-dropdown');
    if (paymentTypesDropdown && !paymentTypesDropdown.contains(event.target)) {
      this.paymentTypesDropdownOpen = false;
    }
  }

  toggleUsersDropdown(): void {
    this.usersDropdownOpen = !this.usersDropdownOpen;
    if (this.usersDropdownOpen) {
      this.paymentTypesDropdownOpen = false;
    }
  }

  togglePaymentTypesDropdown(): void {
    this.paymentTypesDropdownOpen = !this.paymentTypesDropdownOpen;
    if (this.paymentTypesDropdownOpen) {
      this.usersDropdownOpen = false;
    }
  }

  // Client Methods
  toggleClientDropdown(): void {
    this.clientDropdownOpen = !this.clientDropdownOpen;
    if (this.clientDropdownOpen) this.loadClients(this.clientSearchTerm);
  }

  onClientSearch(): void {
    this.clientSearchSubject.next(this.clientSearchTerm);
  }

  loadClients(search?: string): void {
    this.loadingClients = true;
    if (this.hasRoleSuper) {
      this.clientService.getClients(0, 50, search).subscribe({
        next: (response) => {
          this.clients = response.content;
          this.loadingClients = false;
          this.autoSelectIfSingleClient();
        },
        error: () => { this.clients = []; this.loadingClients = false; }
      });
    } else if (this.userClientId) {
      this.clientService.getClient(this.userClientId).subscribe({
        next: (client) => {
          this.clients = [client];
          this.loadingClients = false;
          this.autoSelectIfSingleClient();
        },
        error: () => { this.clients = []; this.loadingClients = false; }
      });
    } else {
      this.clients = [];
      this.loadingClients = false;
    }
  }

  private autoSelectIfSingleClient(): void {
    if (this.clients.length === 1 && !this.selectedClient) {
      this.selectClient(this.clients[0]);
    }
  }

  selectClient(client: Client): void {
    this.selectedClient = client;
    this.clientDropdownOpen = false;
    this.clientSearchTerm = '';
    this.selectedLocation = null;
    this.events = [];
    this.eventCurrentPage = 0;
    this.loadLocations();
    this.loadEvents();
  }

  // Location Methods
  toggleLocationDropdown(): void {
    this.locationDropdownOpen = !this.locationDropdownOpen;
  }

  onLocationSearch(): void {
    // Filtering is handled by the getter
  }

  loadLocations(): void {
    if (!this.selectedClient?.id) return;
    this.loadingLocations = true;
    this.locationService.getLocationsByClientId(this.selectedClient.id, 0, 100).subscribe({
      next: (response) => {
        const parents = response.content.filter(l => !l.parentId);
        const children = response.content.filter(l => l.parentId);
        const sorted: Location[] = [];
        parents.forEach(parent => {
          sorted.push(parent);
          children.filter(c => c.parentId === parent.id).forEach(child => sorted.push(child));
        });
        this.locations = sorted;
        this.loadingLocations = false;
      },
      error: () => { this.locations = []; this.loadingLocations = false; }
    });
  }

  get filteredLocations(): Location[] {
    if (!this.locationSearchTerm.trim()) return this.locations;
    const term = this.locationSearchTerm.toLowerCase();
    return this.locations.filter(l => l.name.toLowerCase().includes(term));
  }

  selectLocation(location: Location): void {
    this.selectedLocation = location;
    this.locationDropdownOpen = false;
    this.locationSearchTerm = '';
    this.events = [];
    this.eventCurrentPage = 0;
    this.loadEvents();
  }

  // Event Methods
  loadEvents(): void {
    if (!this.selectedClient) return;
    this.loadingEvents = true;

    if (this.selectedLocation) {
      // If location is selected, load events for that location only
      const locationIdForEvents = this.selectedLocation.parentId || this.selectedLocation.id!;
      this.eventService.getEventsByLocationId(locationIdForEvents, this.eventCurrentPage, this.eventPageSize).subscribe({
        next: (response) => {
          this.events = response.content;
          this.eventTotalPages = response.totalPages;
          this.loadingEvents = false;
        },
        error: (err) => { console.error('Error loading events:', err); this.loadingEvents = false; }
      });
    } else {
      // If only client is selected, load all events for that client
      this.eventService.getEventsByClientId(this.selectedClient.id!, this.eventCurrentPage, this.eventPageSize).subscribe({
        next: (response) => {
          this.events = response.content;
          this.eventTotalPages = response.totalPages;
          this.loadingEvents = false;
        },
        error: (err) => { console.error('Error loading events:', err); this.loadingEvents = false; }
      });
    }
  }

  onEventSearch(): void {
    this.eventCurrentPage = 0;
    this.loadEvents();
  }

  loadEventPage(page: number): void {
    if (page < 0 || page >= this.eventTotalPages) return;
    this.eventCurrentPage = page;
    this.loadEvents();
  }

  onEventPageSizeChange(size: number): void {
    this.eventPageSize = +size;
    this.eventCurrentPage = 0;
    this.loadEvents();
  }

  getPageNumbers(totalPages: number, currentPage: number): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible);
    if (end - start < maxVisible) { start = Math.max(0, end - maxVisible); }
    for (let i = start; i < end; i++) { pages.push(i); }
    return pages;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  isEventInProgress(event: Event): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(event.startDate + 'T00:00:00');
    const endDate = new Date(event.endDate + 'T23:59:59');
    return today >= startDate && today <= endDate;
  }

  // Modal Methods
  openEventModal(): void {
    this.editingEvent = null;
    this.eventFormData = { name: '', startDate: '', endDate: '', userIds: [], paymentTypeIds: [], menuSource: 'client' };
    this.startDate = null;
    this.endDate = null;
    if (this.users.length === 0 && this.selectedClient) {
      this.loadUsers();
    }
    if (this.paymentTypes.length === 0) {
      this.loadPaymentTypes();
    }
    this.loadEventMenuItems();
    this.showEventModal = true;
  }

  editEvent(event: Event): void {
    this.editingEvent = event;
    this.eventFormData = {
      name: event.name,
      startDate: '',
      endDate: '',
      userIds: event.userIds || [],
      paymentTypeIds: event.paymentTypeIds || [],
      menuSource: (event.menuItemIds && event.menuItemIds.length > 0) ? 'location' : 'client'
    };
    // Set Material datepicker Date values
    this.startDate = event.startDate ? new Date(event.startDate + 'T00:00:00') : null;
    this.endDate = event.endDate ? new Date(event.endDate + 'T00:00:00') : null;
    if (this.users.length === 0 && this.selectedClient) {
      this.loadUsers();
    }
    if (this.paymentTypes.length === 0) {
      this.loadPaymentTypes();
    }
    this.loadEventMenuItems();
    this.showEventModal = true;
  }

  closeEventModal(): void {
    this.showEventModal = false;
    this.editingEvent = null;
    this.usersDropdownOpen = false;
    this.paymentTypesDropdownOpen = false;
  }

  saveEvent(): void {
    // For new events, we need a selected location
    // For editing, we use the event's existing locationId
    const locationId = this.selectedLocation?.id || this.editingEvent?.locationId;
    if (!locationId) return;

    this.savingEvent = true;
    // If location menu is selected, include all menu items from the location
    const menuItemIds = this.eventFormData.menuSource === 'location'
      ? this.eventMenuItems.map(item => item.id!).filter(id => id)
      : [];
    const eventData = {
      name: this.eventFormData.name,
      startDate: this.dateToApiFormat(this.startDate),
      endDate: this.dateToApiFormat(this.endDate),
      userIds: this.eventFormData.userIds,
      paymentTypeIds: this.eventFormData.paymentTypeIds,
      menuItemIds
    };
    const operation = this.editingEvent
      ? this.eventService.updateEvent(this.editingEvent.id!, { ...eventData, locationId })
      : this.eventService.createEvent(locationId, eventData);
    operation.subscribe({
      next: () => { this.closeEventModal(); this.loadEvents(); this.savingEvent = false; },
      error: (err) => { console.error('Error saving event:', err); this.savingEvent = false; }
    });
  }

  private dateToApiFormat(date: Date | null): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  downloadQrPdf(eventId: string): void {
    this.eventService.downloadQrPdf(eventId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-${eventId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Error downloading QR PDF:', err)
    });
  }

  uploadLogo(fileEvent: globalThis.Event, event: Event): void {
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files?.length || !event.id) return;

    const file = input.files[0];
    this.eventService.uploadLogo(event.id, file).subscribe({
      next: (updated) => { event.logoPath = updated.logoPath; },
      error: (err) => console.error('Error uploading logo:', err)
    });
    input.value = '';
  }

  deleteLogo(event: Event): void {
    if (!event.id) return;
    this.eventService.deleteLogo(event.id).subscribe({
      next: () => { event.logoPath = undefined; },
      error: (err) => console.error('Error deleting logo:', err)
    });
  }

  // User Methods
  loadUsers(): void {
    if (!this.selectedClient) return;
    this.loadingUsers = true;
    this.userService.getUsersByClientId(this.selectedClient.id!, 0, 100).subscribe({
      next: (response) => { this.users = response.content; this.loadingUsers = false; },
      error: (err) => { console.error('Error loading users:', err); this.loadingUsers = false; }
    });
  }

  getBarUsers(): User[] {
    return this.users.filter(u => u.roles && u.roles.includes('BAR'));
  }

  getSelectedUsersText(): string {
    const barUsers = this.getBarUsers();
    const selectedUsers = barUsers.filter(u => this.eventFormData.userIds.includes(u.id!));
    if (selectedUsers.length === 0) return '';
    if (selectedUsers.length <= 2) return selectedUsers.map(u => u.name).join(', ');
    return `${selectedUsers.length} users selected`;
  }

  toggleEventUser(userId: string, event: globalThis.Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!this.eventFormData.userIds.includes(userId)) {
        this.eventFormData.userIds.push(userId);
      }
    } else {
      this.eventFormData.userIds = this.eventFormData.userIds.filter(id => id !== userId);
    }
  }

  // Payment Type Methods
  loadPaymentTypes(): void {
    this.loadingPaymentTypes = true;
    this.paymentTypeService.getPaymentTypes(0, 100).subscribe({
      next: (response) => { this.paymentTypes = response.content; this.loadingPaymentTypes = false; },
      error: (err) => { console.error('Error loading payment types:', err); this.loadingPaymentTypes = false; }
    });
  }

  getSelectedPaymentTypesText(): string {
    const selectedPts = this.paymentTypes.filter(pt => this.eventFormData.paymentTypeIds.includes(pt.id!));
    if (selectedPts.length === 0) return '';
    if (selectedPts.length <= 2) return selectedPts.map(pt => pt.name).join(', ');
    return `${selectedPts.length} payment types selected`;
  }

  togglePaymentType(paymentTypeId: string, event: globalThis.Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!this.eventFormData.paymentTypeIds.includes(paymentTypeId)) {
        this.eventFormData.paymentTypeIds.push(paymentTypeId);
      }
    } else {
      this.eventFormData.paymentTypeIds = this.eventFormData.paymentTypeIds.filter(id => id !== paymentTypeId);
    }
  }

  // Menu Items
  loadEventMenuItems(locationId?: string): void {
    const locId = locationId || this.selectedLocation?.id || this.editingEvent?.locationId;
    if (!locId) return;
    this.menuService.getMenuTree(locId).subscribe({
      next: (items) => { this.eventMenuItems = this.flattenMenuItems(items); },
      error: (err) => console.error('Error loading menu items:', err)
    });
  }

  private flattenMenuItems(items: MenuItem[], prefix = ''): MenuItem[] {
    const result: MenuItem[] = [];
    for (const item of items) {
      const displayName = prefix ? `${prefix} > ${item.name}` : item.name;
      if (item.orderable && item.id) {
        result.push({ ...item, name: displayName });
      }
      if (item.children && item.children.length > 0) {
        result.push(...this.flattenMenuItems(item.children, displayName));
      }
    }
    return result;
  }

}