import { Component, OnInit, HostListener, ElementRef, ViewEncapsulation } from '@angular/core';

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
import { EventService, Event, OrderPointSummary } from '../clients/event.service';
import { UserService, User } from '../clients/user.service';
import { MenuService, MenuItem } from '../clients/menu.service';
import { EventOrderPointService, EventOrderPoint } from '../clients/event-order-point.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [FormsModule, TranslateModule, MatDatepickerModule, MatInputModule, MatFormFieldModule],
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
    
            @if (clientDropdownOpen) {
              <div class="selector-dropdown">
                <div class="search-box">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="search-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" class="search-input" [placeholder]="'COMMON.SEARCH' | translate"
                    [(ngModel)]="clientSearchTerm" (input)="onClientSearch()" (click)="$event.stopPropagation()">
                </div>
                <div class="client-list">
                  @if (loadingClients) {
                    <div class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                  }
                  @if (!loadingClients && clients.length === 0) {
                    <div class="empty-state">{{ 'CLIENTS.NO_CLIENTS' | translate }}</div>
                  }
                  @for (client of clients; track client) {
                    <div class="client-option"
                      [class.selected]="selectedClient?.id === client.id" (click)="selectClient(client)">
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
    
        <!-- Location Selector -->
        @if (selectedClient) {
          <div class="location-selector-container">
            <label class="selector-label">{{ 'LOCATIONS.LOCATION' | translate }}</label>
            <div class="selector-wrapper location-wrapper" [class.open]="locationDropdownOpen">
              <div class="selector-input" (click)="toggleLocationDropdown()">
                @if (selectedLocation) {
                  <div class="selected-location">
                    <svg class="location-pin-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span class="location-name">{{ selectedLocation.name }}</span>
                  </div>
                }
                @if (!selectedLocation) {
                  <div class="placeholder">
                    {{ 'MENU.SELECT_LOCATION' | translate }}
                  </div>
                }
                <span class="dropdown-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
    
              @if (locationDropdownOpen) {
                <div class="selector-dropdown">
                  <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="search-icon">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" class="search-input" [placeholder]="'COMMON.SEARCH' | translate"
                      [(ngModel)]="locationSearchTerm" (input)="onLocationSearch()" (click)="$event.stopPropagation()">
                  </div>
                  <div class="location-list">
                    @if (loadingLocations) {
                      <div class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                    }
                    @if (!loadingLocations && filteredLocations.length === 0) {
                      <div class="empty-state">{{ 'LOCATIONS.NO_LOCATIONS' | translate }}</div>
                    }
                    @for (location of filteredLocations; track location) {
                      <div class="location-option"
                        [class.selected]="selectedLocation?.id === location.id"
                        [class.sublocation]="location.parentId"
                        (click)="selectLocation(location)">
                        <svg class="location-pin-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="location-name">{{ location.name }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
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
                      <th>{{ 'LOCATIONS.LOCATION' | translate }}</th>
                      <th>{{ 'EVENTS.START_DATE' | translate }}</th>
                      <th>{{ 'EVENTS.END_DATE' | translate }}</th>
                      <th class="text-center">{{ 'EVENTS.REQUIRE_VALIDATION_SHORT' | translate }}</th>
                      <th class="text-center">{{ 'EVENTS.PAUSED_SHORT' | translate }}</th>
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
                      <tr><td colspan="7" class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</td></tr>
                    } @else if (events.length === 0) {
                      <tr><td colspan="7" class="text-center py-4 text-muted">{{ 'EVENTS.NO_EVENTS' | translate }}</td></tr>
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
                          <td class="text-muted">{{ event.locationName }}</td>
                          <td class="text-muted">{{ formatDate(event.startDate) }}</td>
                          <td class="text-muted">{{ formatDate(event.endDate) }}</td>
                          <td class="text-center">
                            <input type="checkbox" class="credit-checkbox"
                                   [checked]="!!event.requireValidation"
                                   [disabled]="savingValidationFor === event.id"
                                   (change)="toggleRequireValidation(event, $event)"
                                   [title]="'EVENTS.REQUIRE_VALIDATION' | translate">
                          </td>
                          <td class="text-center">
                            <input type="checkbox" class="credit-checkbox"
                                   [checked]="!!event.paused"
                                   [disabled]="savingPausedFor === event.id"
                                   (change)="togglePaused(event, $event)"
                                   [title]="'EVENTS.PAUSED' | translate">
                          </td>
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
                            <button class="btn-icon-action btn-icon-action-sm" (click)="editEvent(event)" [title]="'COMMON.EDIT' | translate">
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
            <div class="card-footer">
              <div class="pagination-container">
                <ul class="pagination-list">
                  <li><a href="javascript:void(0);" (click)="loadEventPage(eventCurrentPage - 1)" [class.disabled]="eventCurrentPage === 0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></a></li>
                  @for (page of getPageNumbers(eventTotalPages, eventCurrentPage); track page) {
                    <li><a href="javascript:void(0);" [class.active]="page === eventCurrentPage" (click)="loadEventPage(page)">{{ page + 1 }}</a></li>
                  }
                  <li><a href="javascript:void(0);" (click)="loadEventPage(eventCurrentPage + 1)" [class.disabled]="eventCurrentPage >= eventTotalPages - 1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></a></li>
                </ul>
                <div class="custom-select page-size-select-custom" [class.open]="pageSizeDropdownOpen" (click)="togglePageSizeDropdown(); $event.stopPropagation()">
                  <div class="custom-select-trigger">
                    <span class="selected-value">{{ eventPageSize }}</span>
                    <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  @if (pageSizeDropdownOpen) {
                    <div class="custom-select-options open-upward square">
                      @for (size of pageSizeOptions; track size) {
                        <div class="custom-select-option" [class.selected]="eventPageSize === size" (click)="selectPageSize(size); $event.stopPropagation()">
                          <span class="option-text">{{ size }}</span>
                          @if (eventPageSize === size) {
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
          </div>
        </div>
      }
    </div>
    
    <!-- Event Modal -->
    @if (showEventModal) {
      <div class="modal-overlay" (mousedown)="closeEventModal()">
        <div class="modal modal-lg" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingEvent ? ('COMMON.EDIT' | translate) : ('COMMON.ADD' | translate) }} {{ 'EVENTS.EVENT' | translate }}</h3>
            <button class="close-btn" (click)="closeEventModal()" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-tabs">
            <button class="modal-tab" [class.active]="eventModalTab === 'details'" (click)="eventModalTab = 'details'">
              {{ 'EVENTS.DETAILS' | translate }}
            </button>
            <button class="modal-tab" [class.active]="eventModalTab === 'tables'" (click)="eventModalTab = 'tables'" [disabled]="!editingEvent">
              {{ 'EVENTS.TABLES' | translate }}
            </button>
            <button class="modal-tab" [class.active]="eventModalTab === 'cashRegisters'" (click)="eventModalTab = 'cashRegisters'" [disabled]="!editingEvent">
              {{ 'EVENTS.CASH_REGISTERS' | translate }}
            </button>
          </div>
          <div class="modal-body">
            <!-- Details Tab -->
            @if (eventModalTab === 'details') {
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
                <label>{{ 'EVENTS.SERVICE_USERS' | translate }}</label>
                <div class="multi-select-wrapper users-dropdown" [class.open]="usersDropdownOpen">
                  <div class="multi-select-input" (click)="toggleUsersDropdown(); $event.stopPropagation()">
                    @if (getSelectedUsersText()) {
                      <span class="selected-text">{{ getSelectedUsersText() }}</span>
                    }
                    @if (!getSelectedUsersText()) {
                      <span class="placeholder">{{ 'EVENTS.SELECT_USERS' | translate }}</span>
                    }
                    <span class="dropdown-arrow">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </div>
                  @if (usersDropdownOpen) {
                    <div class="multi-select-dropdown open-upward" (click)="$event.stopPropagation()">
                      @if (loadingUsers) {
                        <div class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                      }
                      @if (!loadingUsers && getServiceUsers().length === 0) {
                        <div class="empty-state">{{ 'USERS.NO_USERS' | translate }}</div>
                      }
                      @for (user of getServiceUsers(); track user) {
                        <label class="checkbox-option">
                          <input type="checkbox" [checked]="eventFormData.userIds.includes(user.id!)" (change)="toggleEventUser(user.id!, $event)">
                          <span class="checkbox-label-text">{{ user.name }}</span>
                        </label>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Waiter Users Selection -->
              <div class="form-group">
                <label>{{ 'EVENTS.WAITER_USERS' | translate }}</label>
                <div class="multi-select-wrapper waiter-users-dropdown" [class.open]="waiterUsersDropdownOpen">
                  <div class="multi-select-input" (click)="toggleWaiterUsersDropdown(); $event.stopPropagation()">
                    @if (getSelectedWaiterUsersText()) {
                      <span class="selected-text">{{ getSelectedWaiterUsersText() }}</span>
                    }
                    @if (!getSelectedWaiterUsersText()) {
                      <span class="placeholder">{{ 'EVENTS.SELECT_USERS' | translate }}</span>
                    }
                    <span class="dropdown-arrow">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </div>
                  @if (waiterUsersDropdownOpen) {
                    <div class="multi-select-dropdown open-upward" (click)="$event.stopPropagation()">
                      @if (loadingUsers) {
                        <div class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                      }
                      @if (!loadingUsers && getWaiterUsers().length === 0) {
                        <div class="empty-state">{{ 'USERS.NO_USERS' | translate }}</div>
                      }
                      @for (user of getWaiterUsers(); track user) {
                        <label class="checkbox-option">
                          <input type="checkbox" [checked]="eventFormData.waiterUserIds.includes(user.id!)" (change)="toggleEventWaiterUser(user.id!, $event)">
                          <span class="checkbox-label-text">{{ user.name }}</span>
                        </label>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="eventFormData.requireValidation">
                  <span class="checkbox-label-text">{{ 'EVENTS.REQUIRE_VALIDATION' | translate }}</span>
                </label>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="eventFormData.paused">
                  <span class="checkbox-label-text">{{ 'EVENTS.PAUSED' | translate }}</span>
                </label>
              </div>

            }
    
            <!-- Tables Tab -->
            @if (eventModalTab === 'tables') {
              <div class="tables-content">
                @if (loadingTables) {
                  <div class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                } @else if (eventTables.length === 0) {
                  <div class="empty-tables-message">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{{ 'ORDER_POINTS.NO_ORDER_POINTS' | translate }}</span>
                  </div>
                } @else {
                  <table class="tables-table">
                    <thead>
                      <tr>
                        <th>{{ 'LOCATIONS.LOCATION' | translate }}</th>
                        <th>{{ 'EVENTS.CLIENT' | translate }}</th>
                        <th>{{ 'COMMON.PHONE' | translate }}</th>
                        <th>{{ 'EVENTS.USER' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (group of groupedTables; track group.sublocationName) {
                        <tr class="parent-row" (click)="toggleSublocation(group)">
                          <td colspan="4">
                            <div class="parent-cell">
                              <svg class="expand-icon" [class.expanded]="group.expanded" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                              </svg>
                              <span class="sublocation-name">{{ group.sublocationName }}</span>
                            </div>
                          </td>
                        </tr>
                        @if (group.expanded) {
                          @for (table of group.orderPoints; track table.orderPointId) {
                            <tr class="child-row">
                              <td class="location-cell">
                                <span class="order-point-name">{{ table.orderPointName }}</span>
                              </td>
                              <td class="editable-cell" (click)="startEditing(table.orderPointId, 'clientName', $event)">
                                @if (editingCell?.orderPointId === table.orderPointId && editingCell?.field === 'clientName') {
                                  <input type="text" class="inline-input" [(ngModel)]="table.clientName" (blur)="onCellBlur(table)" (keydown.enter)="onCellBlur(table)" (keydown.tab)="onCellTab($event, table, 'phone')" #editInput>
                                } @else {
                                  <span class="cell-value">{{ table.clientName || '' }}</span>
                                }
                              </td>
                              <td class="editable-cell" (click)="startEditing(table.orderPointId, 'phone', $event)">
                                @if (editingCell?.orderPointId === table.orderPointId && editingCell?.field === 'phone') {
                                  <input type="tel" class="inline-input" [(ngModel)]="table.phone" (blur)="onCellBlur(table)" (keydown.enter)="onCellBlur(table)" (keydown.tab)="onCellTab($event, table, null)" #editInput>
                                } @else {
                                  <span class="cell-value">{{ table.phone || '' }}</span>
                                }
                              </td>
                              <td class="user-cell">
                                <select class="user-select" [ngModel]="table.userId || ''" (ngModelChange)="onUserChange(table, $event)">
                                  <option value="">-</option>
                                  @for (u of waiterUsers; track u.id) {
                                    <option [value]="u.id">{{ u.name }}</option>
                                  }
                                </select>
                              </td>
                            </tr>
                          }
                        }
                      }
                    </tbody>
                  </table>
                }
              </div>
            }
    
            <!-- Cash Registers Tab -->
            @if (eventModalTab === 'cashRegisters') {
              <div class="cash-registers-content">
                <div class="cash-registers-header">
                  <button class="btn btn-sm btn-primary" (click)="addCashRegister()">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    {{ 'COMMON.ADD' | translate }}
                  </button>
                </div>
                @if (cashRegisters.length === 0) {
                  <div class="empty-tables-message">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>{{ 'EVENTS.NO_CASH_REGISTERS' | translate }}</span>
                  </div>
                } @else {
                  <table class="tables-table cash-registers-table">
                    <thead>
                      <tr>
                        <th>{{ 'COMMON.NAME' | translate }}</th>
                        <th>IP</th>
                        <th class="actions-col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (cr of cashRegisters; track cr.id || cr.tempId) {
                        <tr>
                          <td class="editable-cell" (click)="startEditingCashRegister(cr, 'name', $event)">
                            @if (isEditingCashRegister(cr, 'name')) {
                              <input type="text" class="inline-input" [(ngModel)]="cr.name" (blur)="onCashRegisterBlur(cr)" (keydown.enter)="onCashRegisterBlur(cr)" #editInput>
                            } @else {
                              <span class="cell-value">{{ cr.name || '' }}</span>
                            }
                          </td>
                          <td class="editable-cell" (click)="startEditingCashRegister(cr, 'ip', $event)">
                            @if (isEditingCashRegister(cr, 'ip')) {
                              <input type="text" class="inline-input" [(ngModel)]="cr.ip" (blur)="onCashRegisterBlur(cr)" (keydown.enter)="onCashRegisterBlur(cr)" #editInput>
                            } @else {
                              <span class="cell-value">{{ cr.ip || '' }}</span>
                            }
                          </td>
                          <td class="actions-col">
                            <div class="row-actions">
                              @if (cr.id) {
                                <button class="btn-icon-action btn-icon-assign" (click)="openAssignModal(cr)" title="Assign order points">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  </svg>
                                </button>
                              }
                              <button class="btn-icon-action btn-icon-delete" (click)="deleteCashRegister(cr)" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeEventModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            @if (eventModalTab === 'details') {
              <button class="btn btn-primary" (click)="saveEvent()" [disabled]="!eventFormData.name.trim() || savingEvent">
                {{ savingEvent ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
              </button>
            }
          </div>
        </div>
      </div>
    }

    <!-- Assign Order Points to Cash Register Modal -->
    @if (showAssignModal) {
      <div class="modal-overlay assign-modal-overlay" (mousedown)="closeAssignModal()">
        <div class="modal assign-modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Assign order points{{ assignModalCashRegister?.name ? ' — ' + assignModalCashRegister?.name : '' }}</h3>
            <button class="close-btn" (click)="closeAssignModal()" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-body assign-modal-body">
            @if (loadingAssignments) {
              <div class="empty-tables-message">{{ 'COMMON.LOADING' | translate }}</div>
            } @else if (assignableOrderPoints.length === 0) {
              <div class="empty-tables-message">No parent order points available at this event's location. All are either already assigned to another cash register or there are no order points yet.</div>
            } @else {
              <div class="assign-hint">Pick parent order points to assign to this cash register. Split sub-order-points (e.g. M3.1) inherit from their parent and don't appear here.</div>
              <div class="assign-list">
                @for (op of assignableOrderPoints; track op.id) {
                  <label class="assign-row">
                    <input type="checkbox" class="assign-checkbox"
                      [checked]="isAssignSelected(op.id)"
                      (change)="toggleAssignSelection(op.id)">
                    <span class="assign-name">{{ op.name }}</span>
                  </label>
                }
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeAssignModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveAssignments()" [disabled]="savingAssignments || loadingAssignments">
              {{ savingAssignments ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
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
    .selector-input { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 0; background: white; cursor: pointer; transition: all 0.2s ease; }
    .selector-input:hover { border-color: #cbd5e1; }
    .selector-wrapper.open .selector-input { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .selected-client, .selected-location { display: flex; align-items: center; gap: 8px; }
    .placeholder { color: #94a3b8; }
    .dropdown-arrow { display: flex; align-items: center; color: #94a3b8; transition: transform 0.2s ease; }
    .dropdown-arrow svg { width: 18px; height: 18px; }
    .selector-wrapper.open .dropdown-arrow { transform: rotate(180deg); }
    .selector-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100; max-height: 350px; display: flex; flex-direction: column; }
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
    .card { background: white; border-radius: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card.stretch { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .card-body { padding: 20px; }
    .card-body.p-0 { padding: 0 !important; flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .card-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; flex-shrink: 0; }

    /* Table - matches users table styling */
    .table-responsive { flex: 1; overflow-x: auto; overflow-y: auto; min-height: 0; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .table thead th {
      padding: 12px 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      background: white;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      text-align: left;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .table tbody td {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
      vertical-align: middle;
      font-size: 14px;
      color: var(--text-dark);
    }
    .table tbody tr:last-child td { border-bottom: none; }
    .table-hover tbody tr { transition: background 0.15s ease; }
    .table-hover tbody tr:hover { background: var(--bg-light); }
    .table.mb-0 { margin-bottom: 0; }
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .text-muted { color: var(--text-muted); }
    .py-4 { padding-top: 24px; padding-bottom: 24px; }

    .th-with-search { display: flex; align-items: center; gap: 12px; }
    .search-input-wrapper { display: flex; align-items: center; gap: 6px; padding: 9px 10px; border: 1px solid var(--border-color); border-radius: 0; background: white; }
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
    .btn-icon-action { width: 32px; height: 32px; border: 1px solid rgba(0, 0, 0, 0.08); background: transparent; border-radius: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #64748b; transition: all 0.15s ease; margin-left: 4px; }
    .btn-icon-action:hover { background: rgba(0, 0, 0, 0.04); color: #374151; }
    .btn-icon-action svg { width: 16px; height: 16px; }
    .btn-icon-action-sm { width: 34px; height: 34px; border-radius: 0; }
    .btn-icon-action-sm svg { width: 17px; height: 17px; }
    .btn-icon-add { background: transparent; border-color: rgba(0, 0, 0, 0.08); color: #64748b; border-radius: 0; }
    .btn-icon-add:hover { background: rgba(0, 0, 0, 0.04); border-color: rgba(0, 0, 0, 0.08); color: #374151; }
    .btn-icon-delete:hover { background: rgba(253, 106, 106, 0.1); color: var(--danger); border-color: rgba(253, 106, 106, 0.3); }
    label.btn-icon-action { cursor: pointer; }

    .btn { padding: 8px 16px; border-radius: 0; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
    .btn-primary { background: white; color: var(--primary); border-color: var(--primary); }
    .btn-primary:hover { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }
    .btn-primary:disabled { background: white; color: #94a3b8; border-color: #94a3b8; cursor: not-allowed; }
    .btn-secondary { background: white; color: #64748b; border-color: var(--border-color); }
    .btn-secondary:hover { background: white; color: #374151; border-color: #cbd5e1; }

    /* Pagination */
    .pagination-container { display: flex; align-items: center; gap: 16px; width: 100%; justify-content: flex-end; }
    .pagination-list { display: flex; align-items: center; gap: 4px; list-style: none; margin: 0; padding: 0; }
    .pagination-list li a { display: flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 8px; border-radius: 0; font-size: 13px; color: var(--text-muted); text-decoration: none; transition: all 0.15s ease; }
    .pagination-list li a:hover:not(.disabled):not(.active) { background: var(--bg-light); color: var(--text-dark); }
    .pagination-list li a.active { background: var(--primary); color: white; }
    .pagination-list li a.disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .pagination-list li a svg { width: 16px; height: 16px; }
    /* Custom Select - Duralux Style */
    .custom-select { position: relative; width: 100%; cursor: pointer; }
    .custom-select-trigger { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: white; border: 1px solid var(--border-color); border-radius: 0; font-size: 14px; color: var(--text-dark); transition: all 0.2s ease; }
    .custom-select:hover .custom-select-trigger { border-color: #cbd5e1; }
    .custom-select.open .custom-select-trigger { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .selected-value { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    .selected-value.placeholder { color: var(--text-muted); font-weight: 400; }
    .custom-select .dropdown-arrow { width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.2s ease; flex-shrink: 0; }
    .custom-select.open .dropdown-arrow { transform: rotate(180deg); }
    .custom-select-options { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid var(--border-color); border-radius: 0; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12); z-index: 1100; overflow: hidden; }
    .custom-select-options.open-upward { top: auto; bottom: calc(100% + 4px); }
    .custom-select-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 14px; color: var(--text-dark); cursor: pointer; transition: background 0.15s ease; }
    .custom-select-option:hover { background: var(--bg-light); }
    .custom-select-option.selected { background: var(--primary-light); color: var(--primary); font-weight: 500; }
    .custom-select-option:first-child,
    .custom-select-option:last-child,
    .custom-select-option:only-child { border-radius: 0; }
    .option-text { flex: 1; }
    .check-icon { width: 16px; height: 16px; color: var(--primary); margin-left: auto; }

    .custom-select.page-size-select-custom { width: auto; min-width: 72px; flex: 0 0 auto; }
    .custom-select.page-size-select-custom .custom-select-trigger { padding: 6px 10px; border-radius: 0; font-size: 13px; }
    .custom-select.page-size-select-custom .selected-value { font-weight: 400; }
    .custom-select.page-size-select-custom .custom-select-options { min-width: 100%; width: auto; }
    .custom-select-options.square { border-radius: 0; }
    .custom-select-options.square .custom-select-option,
    .custom-select-options.square .custom-select-option:first-child,
    .custom-select-options.square .custom-select-option:last-child,
    .custom-select-options.square .custom-select-option:only-child { border-radius: 0; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 0; width: 100%; max-width: 680px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15); max-height: 90vh; display: flex; flex-direction: column; }
    .modal.modal-lg { max-width: 75vw; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: none; flex-shrink: 0; }
    .modal-tabs { display: flex; gap: 0; padding: 0 20px; border-bottom: 1px solid #e2e8f0; }
    .modal-tab { padding: 12px 20px; border: none; background: none; font-size: 14px; font-weight: 500; color: var(--text-muted); cursor: pointer; position: relative; transition: color 0.2s ease; }
    .modal-tab:hover:not(:disabled) { color: var(--text-dark); }
    .modal-tab:disabled { opacity: 0.5; cursor: not-allowed; }
    .modal-tab.active { color: var(--primary); }
    .modal-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--primary); }
    .in-progress-message { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--text-muted); gap: 12px; }
    .in-progress-message svg { width: 48px; height: 48px; opacity: 0.5; }
    .in-progress-message span { font-size: 16px; font-weight: 500; }

    /* Tables tab styles */
    .tables-content { min-height: 200px; }
    .tables-content .loading-state { padding: 40px 20px; text-align: center; color: var(--text-muted); }
    .empty-tables-message { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--text-muted); gap: 12px; }
    .empty-tables-message svg { width: 48px; height: 48px; opacity: 0.5; }
    .empty-tables-message span { font-size: 14px; }
    .tables-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .tables-table th, .tables-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border-color); }
    .tables-table th:nth-child(2),
    .tables-table th:nth-child(3),
    .tables-table th:nth-child(4) { text-align: center; }
    .tables-table th { font-size: 12px; font-weight: 600; color: var(--text-dark); background: var(--bg-light); white-space: nowrap; }
    .tables-table th:nth-child(1) { width: 20%; }
    .tables-table th:nth-child(2) { width: 30%; }
    .tables-table th:nth-child(3) { width: 30%; }
    .tables-table th:nth-child(4) { width: 20%; }
    .tables-table td { font-size: 13px; color: var(--text-dark); }
    .tables-table .parent-row { background: var(--bg-light); cursor: pointer; }
    .tables-table .parent-row:hover { background: #e2e8f0; }
    .tables-table .parent-row td { padding: 10px 12px; }
    .parent-cell { display: flex; align-items: center; gap: 8px; }
    .expand-icon { width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.2s ease; flex-shrink: 0; }
    .expand-icon.expanded { transform: rotate(90deg); }
    .sublocation-name { font-weight: 600; color: var(--text-dark); }
    .tables-table .child-row:hover { background: var(--bg-light); }
    .tables-table .child-row .location-cell { padding-left: 36px; }
    .order-point-name { font-weight: 500; }
    .editable-cell { cursor: pointer; }
    .editable-cell:hover { background: rgba(59, 130, 246, 0.05); }
    .cell-value { display: block; padding: 6px 10px; border-radius: 6px; height: 32px; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .editable-cell:hover .cell-value { background: rgba(59, 130, 246, 0.08); }
    .inline-input { width: 100%; padding: 5px 9px; border: 1px solid var(--primary); border-radius: 0; font-size: 13px; color: var(--text-dark); background: white; box-shadow: 0 0 0 2px var(--primary-light); height: 32px; box-sizing: border-box; }
    .inline-input:focus { outline: none; }
    .credit-value-input { text-align: right; }
    .disabled-cell { cursor: not-allowed; opacity: 0.5; }
    .user-cell { padding: 6px 12px; }
    .user-select {
      width: 100%;
      height: 32px;
      padding: 0 28px 0 8px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 0;
      font-size: 13px;
      color: var(--text-dark);
      background: transparent;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
      background-size: 14px;
    }
    .user-select:hover { background-color: rgba(0, 0, 0, 0.04); }
    .user-select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--primary-light);
    }
    .disabled-cell:hover { background: transparent; }
    .disabled-cell .cell-value { background: transparent; }
    .checkbox-cell { text-align: center; }
    .credit-checkbox { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; border: 1px solid #d1d5db; background: white; cursor: pointer; position: relative; transition: all 0.15s ease; }
    .credit-checkbox:hover { border-color: #9ca3af; }
    .credit-checkbox:checked { background: var(--primary); border-color: var(--primary); }
    .credit-checkbox:checked::after { content: ''; position: absolute; left: 5px; top: 1px; width: 5px; height: 10px; border: solid white; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }

    /* Cash Registers tab styles */
    .cash-registers-content { min-height: 200px; }
    .cash-registers-header { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    .btn-sm { padding: 6px 12px; font-size: 13px; }
    .btn-sm svg { width: 14px; height: 14px; }
    .cash-registers-table th:nth-child(1) { width: 45%; }
    .cash-registers-table th:nth-child(2) { width: 35%; }
    .cash-registers-table th:nth-child(3) { width: 20%; }
    .cash-registers-table .actions-col { text-align: center; width: 100px; }
    .cash-registers-table .row-actions { display: inline-flex; gap: 4px; justify-content: center; }
    .btn-icon-assign { color: var(--primary); }
    .btn-icon-assign:hover { color: var(--primary); background: var(--primary-light); }

    /* Assign Order Points Modal */
    .assign-modal { width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; }
    .assign-modal-overlay { z-index: 1100; }
    .assign-modal-body { padding: 20px; }
    .assign-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    .assign-list { display: flex; flex-direction: column; gap: 2px; max-height: 380px; overflow-y: auto; border: 1px solid var(--border-color); }
    .assign-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.15s ease; }
    .assign-row:last-child { border-bottom: none; }
    .assign-row:hover { background: var(--bg-light); }
    .assign-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary); margin: 0; flex-shrink: 0; }
    .assign-name { font-size: 14px; color: var(--text-dark); user-select: none; }

    .modal-header h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; }
    .close-btn { width: 32px; height: 32px; border: 1px solid var(--border-color); background: transparent; border-radius: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; padding: 0; }
    .close-btn:hover { background: transparent; color: #374151; border-color: #cbd5e1; }
    .close-btn svg { width: 16px; height: 16px; display: block; }
    .modal-body { padding: 20px; overflow-y: auto; overflow-x: visible; flex: 1; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px; }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 0; font-size: 14px; color: var(--text-dark); box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .form-row { display: flex; gap: 16px; }
    .form-row .form-group { flex: 1; }

    /* Multi-select */
    .multi-select-wrapper { position: relative; }
    .multi-select-input { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 0; background: white; cursor: pointer; transition: all 0.2s ease; }
    .multi-select-input:hover { border-color: #cbd5e1; }
    .multi-select-wrapper.open .multi-select-input { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .selected-text { font-size: 14px; color: var(--text-dark); }
    .multi-select-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid var(--border-color); border-radius: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 1100; max-height: 200px; overflow-y: auto; }
    .multi-select-dropdown.open-upward { top: auto; bottom: calc(100% + 4px); }
    .checkbox-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s ease; }
    .checkbox-option:hover { background: var(--bg-light); }
    .checkbox-option input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; }
    .checkbox-option span { font-size: 14px; color: var(--text-dark); }
    .checkbox-label-text { margin-left: 8px; }
    .checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: normal !important; }
    .checkbox-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }

    /* Custom DateTime Picker */
    .datetime-picker-wrapper { position: relative; }
    .datetime-input { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 0; background: white; cursor: pointer; transition: all 0.2s ease; }
    .datetime-input:hover { border-color: #cbd5e1; }
    .datetime-picker-wrapper.open .datetime-input { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .datetime-picker-wrapper.open .dropdown-arrow { transform: rotate(180deg); }
    .calendar-icon { width: 18px; height: 18px; color: var(--text-muted); flex-shrink: 0; }
    .datetime-value { font-size: 14px; color: var(--text-dark); flex: 1; }
    .datetime-placeholder { font-size: 14px; color: #94a3b8; flex: 1; }
    .datetime-dropdown { position: absolute; top: calc(100% + 4px); left: 0; background: white; border: 1px solid var(--border-color); border-radius: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 200; padding: 12px; min-width: 280px; }
    .calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .nav-btn { width: 28px; height: 28px; border: 1px solid var(--border-color); background: white; border-radius: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--text-muted); transition: all 0.15s ease; }
    .nav-btn:hover { background: var(--bg-light); color: var(--text-dark); }
    .month-year { font-size: 14px; font-weight: 600; color: var(--text-dark); }
    .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 8px; }
    .calendar-weekdays span { font-size: 11px; font-weight: 600; color: var(--text-muted); text-align: center; padding: 4px; text-transform: uppercase; }
    .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .calendar-day { font-size: 13px; color: var(--text-dark); text-align: center; padding: 8px 4px; border-radius: 0; cursor: pointer; transition: all 0.15s ease; }
    .calendar-day:hover { background: var(--bg-light); }
    .calendar-day.other-month { color: #cbd5e1; }
    .calendar-day.today { font-weight: 600; color: var(--primary); }
    .calendar-day.selected { background: var(--primary); color: white; }
    .calendar-day.selected:hover { background: #2563eb; }
    .time-section { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); }
    .time-label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
    .time-select { padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 0; font-size: 14px; color: var(--text-dark); background: white; cursor: pointer; min-width: 50px; }
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
      border-radius: 0 !important;
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
      border-radius: 0 !important;
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
  savingValidationFor: string | null = null;
  savingPausedFor: string | null = null;
  showEventModal = false;
  eventModalTab: 'details' | 'tables' | 'cashRegisters' = 'details';
  editingEvent: Event | null = null;
  eventCurrentPage = 0;
  eventTotalPages = 0;
  eventPageSize = 10;
  eventSearchTerm = '';
  pageSizeOptions = [5, 10, 20, 50];
  eventFormData: { name: string; startDate: string; endDate: string; userIds: string[]; waiterUserIds: string[]; requireValidation: boolean; paused: boolean } = {
    name: '', startDate: '', endDate: '', userIds: [], waiterUserIds: [], requireValidation: false, paused: false
  };

  // Users
  users: User[] = [];
  loadingUsers = false;
  usersDropdownOpen = false;
  waiterUsersDropdownOpen = false;
  pageSizeDropdownOpen = false;


  // Menu Items for event
  eventMenuItems: MenuItem[] = [];

  // Tables tab
  eventTables: EventOrderPoint[] = [];
  groupedTables: { sublocationName: string; orderPoints: EventOrderPoint[]; expanded: boolean }[] = [];
  loadingTables = false;
  savingTables = false;
  editingCell: { orderPointId: string; field: string } | null = null;

  // Cash Registers tab
  cashRegisters: { id?: string; tempId?: string; name: string; ip: string }[] = [];
  editingCashRegister: { id: string; field: string } | null = null;
  private cashRegisterTempIdCounter = 0;

  // Assign-order-points-to-cash-register modal state.
  showAssignModal = false;
  assignModalCashRegister: { id?: string; tempId?: string; name: string; ip: string } | null = null;
  assignableOrderPoints: OrderPointSummary[] = [];
  /** Selected order point IDs. Initialised from the server's "assigned" list when the modal opens. */
  selectedOrderPointIds = new Set<string>();
  loadingAssignments = false;
  savingAssignments = false;

  // Material Date Picker
  startDate: Date | null = null;
  endDate: Date | null = null;

  private clientSearchSubject = new Subject<string>();

  constructor(
    private clientService: ClientService,
    private locationService: LocationService,
    public eventService: EventService,
    private userService: UserService,
    private menuService: MenuService,
    private eventOrderPointService: EventOrderPointService,
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
    const waiterUsersDropdown = this.elementRef.nativeElement.querySelector('.waiter-users-dropdown');
    if (waiterUsersDropdown && !waiterUsersDropdown.contains(event.target)) {
      this.waiterUsersDropdownOpen = false;
    }
    const pageSizeDropdown = this.elementRef.nativeElement.querySelector('.page-size-select-custom');
    if (pageSizeDropdown && !pageSizeDropdown.contains(event.target)) {
      this.pageSizeDropdownOpen = false;
    }
  }

  toggleUsersDropdown(): void {
    this.usersDropdownOpen = !this.usersDropdownOpen;
  }

  toggleWaiterUsersDropdown(): void {
    this.waiterUsersDropdownOpen = !this.waiterUsersDropdownOpen;
  }

  togglePageSizeDropdown(): void {
    this.pageSizeDropdownOpen = !this.pageSizeDropdownOpen;
  }

  selectPageSize(size: number): void {
    this.pageSizeDropdownOpen = false;
    this.onEventPageSizeChange(size);
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
      this.clientService.getClients(0, 50, search, 'EVENT').subscribe({
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
          // Only show if client is of type EVENT
          this.clients = client.clientTypeName === 'EVENT' ? [client] : [];
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
    this.eventModalTab = 'details';
    this.eventFormData = { name: '', startDate: '', endDate: '', userIds: [], waiterUserIds: [], requireValidation: false, paused: false };
    this.startDate = null;
    this.endDate = null;
    if (this.users.length === 0 && this.selectedClient) {
      this.loadUsers();
    }
    this.loadEventMenuItems();
    this.showEventModal = true;
  }

  editEvent(event: Event): void {
    this.editingEvent = event;
    this.eventModalTab = 'details';
    this.eventFormData = {
      name: event.name,
      startDate: '',
      endDate: '',
      userIds: event.userIds || [],
      waiterUserIds: event.waiterUserIds || [],
      requireValidation: !!event.requireValidation,
      paused: !!event.paused
    };
    // Set Material datepicker Date values
    this.startDate = event.startDate ? new Date(event.startDate + 'T00:00:00') : null;
    this.endDate = event.endDate ? new Date(event.endDate + 'T00:00:00') : null;
    if (this.users.length === 0 && this.selectedClient) {
      this.loadUsers();
    }
    this.loadEventMenuItems();
    this.loadEventTables();
    this.loadCashRegisters();
    this.showEventModal = true;
  }

  closeEventModal(): void {
    this.showEventModal = false;
    this.editingEvent = null;
    this.usersDropdownOpen = false;
    this.waiterUsersDropdownOpen = false;
    this.cashRegisters = [];
  }

  saveEvent(): void {
    // For new events, we need a selected location
    // For editing, we use the event's existing locationId
    const locationId = this.selectedLocation?.id || this.editingEvent?.locationId;
    if (!locationId) return;

    this.savingEvent = true;
    // Always use location menu items
    const menuItemIds = this.eventMenuItems.map(item => item.id!).filter(id => id);
    const eventData = {
      name: this.eventFormData.name,
      startDate: this.dateToApiFormat(this.startDate),
      endDate: this.dateToApiFormat(this.endDate),
      userIds: this.eventFormData.userIds,
      waiterUserIds: this.eventFormData.waiterUserIds,
      menuItemIds,
      requireValidation: this.eventFormData.requireValidation,
      paused: this.eventFormData.paused
    };
    const operation = this.editingEvent
      ? this.eventService.updateEvent(this.editingEvent.id!, { ...eventData, locationId })
      : this.eventService.createEvent(locationId, eventData);
    operation.subscribe({
      next: () => { this.closeEventModal(); this.loadEvents(); this.savingEvent = false; },
      error: (err) => { console.error('Error saving event:', err); this.savingEvent = false; }
    });
  }

  toggleRequireValidation(event: Event, change: any): void {
    if (!event.id) return;
    const target = change?.target as HTMLInputElement | undefined;
    const newValue = target ? target.checked : !event.requireValidation;
    const previous = !!event.requireValidation;
    event.requireValidation = newValue;
    this.savingValidationFor = event.id;
    this.eventService.updateEvent(event.id, {
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      locationId: event.locationId,
      userIds: event.userIds,
      waiterUserIds: event.waiterUserIds,
      paymentTypeIds: event.paymentTypeIds,
      menuItemIds: event.menuItemIds,
      requireValidation: newValue,
      paused: !!event.paused
    }).subscribe({
      next: () => { this.savingValidationFor = null; },
      error: (err) => {
        console.error('Error updating requireValidation:', err);
        event.requireValidation = previous;
        if (target) target.checked = previous;
        this.savingValidationFor = null;
      }
    });
  }

  togglePaused(event: Event, change: any): void {
    if (!event.id) return;
    const target = change?.target as HTMLInputElement | undefined;
    const newValue = target ? target.checked : !event.paused;
    const previous = !!event.paused;
    event.paused = newValue;
    this.savingPausedFor = event.id;
    this.eventService.updateEvent(event.id, {
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      locationId: event.locationId,
      userIds: event.userIds,
      waiterUserIds: event.waiterUserIds,
      paymentTypeIds: event.paymentTypeIds,
      menuItemIds: event.menuItemIds,
      requireValidation: !!event.requireValidation,
      paused: newValue
    }).subscribe({
      next: () => { this.savingPausedFor = null; },
      error: (err) => {
        console.error('Error updating paused:', err);
        event.paused = previous;
        if (target) target.checked = previous;
        this.savingPausedFor = null;
      }
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

  getServiceUsers(): User[] {
    return this.users.filter(u => u.roles && u.roles.includes('SERVICE'));
  }

  getWaiterUsers(): User[] {
    return this.users.filter(u => u.roles && u.roles.includes('WAITER'));
  }

  getSelectedUsersText(): string {
    const serviceUsers = this.getServiceUsers();
    const selectedUsers = serviceUsers.filter(u => this.eventFormData.userIds.includes(u.id!));
    if (selectedUsers.length === 0) return '';
    if (selectedUsers.length <= 2) return selectedUsers.map(u => u.name).join(', ');
    return `${selectedUsers.length} users selected`;
  }

  getSelectedWaiterUsersText(): string {
    const waiterUsers = this.getWaiterUsers();
    const selectedUsers = waiterUsers.filter(u => this.eventFormData.waiterUserIds.includes(u.id!));
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

  toggleEventWaiterUser(userId: string, event: globalThis.Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!this.eventFormData.waiterUserIds.includes(userId)) {
        this.eventFormData.waiterUserIds.push(userId);
      }
    } else {
      this.eventFormData.waiterUserIds = this.eventFormData.waiterUserIds.filter(id => id !== userId);
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

  // Tables tab methods
  loadEventTables(): void {
    if (!this.editingEvent?.id) return;

    this.loadingTables = true;
    this.eventTables = [];
    this.groupedTables = [];

    this.eventOrderPointService.getEventOrderPoints(this.editingEvent.id).subscribe({
      next: (tables) => {
        this.eventTables = tables;
        this.groupedTables = this.groupTablesBySublocation(tables);
        this.loadingTables = false;
      },
      error: (err) => {
        console.error('Error loading event tables:', err);
        this.loadingTables = false;
      }
    });
  }

  private groupTablesBySublocation(tables: EventOrderPoint[]): { sublocationName: string; orderPoints: EventOrderPoint[]; expanded: boolean }[] {
    const groups: { [key: string]: EventOrderPoint[] } = {};
    for (const table of tables) {
      if (!groups[table.sublocationName]) {
        groups[table.sublocationName] = [];
      }
      groups[table.sublocationName].push(table);
    }
    return Object.keys(groups).map(sublocationName => ({
      sublocationName,
      orderPoints: groups[sublocationName],
      expanded: true
    }));
  }

  toggleSublocation(group: { expanded: boolean }): void {
    group.expanded = !group.expanded;
  }

  startEditing(orderPointId: string, field: string, event: MouseEvent): void {
    event.stopPropagation();
    this.editingCell = { orderPointId, field };
    // Focus the input after Angular renders it
    setTimeout(() => {
      const input = this.elementRef.nativeElement.querySelector('.editable-cell input');
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  onCellBlur(table: EventOrderPoint): void {
    if (!this.editingCell) return;
    this.editingCell = null;
    this.saveEventTable(table);
  }

  onCellTab(event: globalThis.Event, table: EventOrderPoint, nextField: string | null): void {
    event.preventDefault();
    if (nextField) {
      // Save current and move to next field
      this.saveEventTable(table);
      this.editingCell = { orderPointId: table.orderPointId, field: nextField };
      setTimeout(() => {
        const input = this.elementRef.nativeElement.querySelector('.editable-cell input');
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
    } else {
      // Last column - just blur
      this.editingCell = null;
      this.saveEventTable(table);
    }
  }

  saveEventTable(table: EventOrderPoint): void {
    if (!this.editingEvent?.id) return;

    this.savingTables = true;
    this.eventOrderPointService.saveEventOrderPoint(this.editingEvent.id, table.orderPointId, table).subscribe({
      next: (saved) => {
        // Update the table in the list
        const index = this.eventTables.findIndex(t => t.orderPointId === saved.orderPointId);
        if (index >= 0) {
          this.eventTables[index] = saved;
        }
        this.savingTables = false;
      },
      error: (err) => {
        console.error('Error saving event table:', err);
        this.savingTables = false;
      }
    });
  }

  onCreditChange(table: EventOrderPoint): void {
    if (!table.credit) {
      table.creditValue = undefined;
    }
    this.saveEventTable(table);
  }

  get serviceUsers(): User[] {
    return this.users.filter(u => u.roles?.includes('SERVICE'));
  }

  get waiterUsers(): User[] {
    return this.users.filter(u => u.roles?.includes('WAITER'));
  }

  onUserChange(table: EventOrderPoint, userId: string): void {
    const newId = userId || null;
    if ((table.userId || null) === newId) return;
    table.userId = newId;
    const matched = newId ? this.users.find(u => u.id === newId) : null;
    table.userName = matched?.name;
    this.saveEventTable(table);
  }

  // Cash Register Methods
  addCashRegister(): void {
    const tempId = `temp-${++this.cashRegisterTempIdCounter}`;
    this.cashRegisters.push({ tempId, name: '', ip: '' });
  }

  isEditingCashRegister(cr: { id?: string; tempId?: string }, field: string): boolean {
    if (!this.editingCashRegister) return false;
    const crIdentifier = cr.id || cr.tempId;
    return this.editingCashRegister.id === crIdentifier && this.editingCashRegister.field === field;
  }

  deleteCashRegister(cr: { id?: string; tempId?: string }): void {
    const index = this.cashRegisters.findIndex(c =>
      (cr.id && c.id === cr.id) || (cr.tempId && c.tempId === cr.tempId)
    );
    if (index >= 0) {
      this.cashRegisters.splice(index, 1);
      this.saveCashRegisters();
    }
  }

  startEditingCashRegister(cr: { id?: string; tempId?: string }, field: string, event: MouseEvent): void {
    event.stopPropagation();
    this.editingCashRegister = { id: cr.id || cr.tempId || '', field };
    setTimeout(() => {
      const input = this.elementRef.nativeElement.querySelector('.cash-registers-table .editable-cell input');
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  onCashRegisterBlur(cr: { id?: string; tempId?: string; name: string; ip: string }): void {
    this.editingCashRegister = null;
    this.saveCashRegisters();
  }

  private saveCashRegisters(): void {
    if (!this.editingEvent?.id) return;
    // Save cash registers to the event
    this.eventService.saveCashRegisters(this.editingEvent.id, this.cashRegisters).subscribe({
      next: (saved) => {
        this.cashRegisters = saved;
      },
      error: (err) => console.error('Error saving cash registers:', err)
    });
  }

  private loadCashRegisters(): void {
    if (!this.editingEvent?.id) return;
    this.eventService.getCashRegisters(this.editingEvent.id).subscribe({
      next: (registers) => {
        this.cashRegisters = registers;
      },
      error: (err) => console.error('Error loading cash registers:', err)
    });
  }

  // Assign-order-points-to-cash-register modal
  openAssignModal(cr: { id?: string; tempId?: string; name: string; ip: string }): void {
    if (!cr.id) return; // Guard: the button is hidden for unsaved rows, but be defensive.
    this.assignModalCashRegister = cr;
    this.showAssignModal = true;
    this.loadingAssignments = true;
    this.assignableOrderPoints = [];
    this.selectedOrderPointIds = new Set<string>();
    this.eventService.getCashRegisterOrderPoints(cr.id).subscribe({
      next: (response) => {
        // The pool the user picks from is "currently assigned to this CR" + "still
        // assignable" — both rendered together so the user can untick existing
        // assignments to drop them on save.
        const merged = [...response.assigned, ...response.assignable];
        // De-dupe by id just in case the backend ever returns overlap.
        const seen = new Set<string>();
        this.assignableOrderPoints = merged.filter(op => {
          if (seen.has(op.id)) return false;
          seen.add(op.id);
          return true;
        });
        this.selectedOrderPointIds = new Set(response.assigned.map(op => op.id));
        this.loadingAssignments = false;
      },
      error: (err) => {
        console.error('Error loading order point assignments:', err);
        this.loadingAssignments = false;
      }
    });
  }

  closeAssignModal(): void {
    this.showAssignModal = false;
    this.assignModalCashRegister = null;
    this.assignableOrderPoints = [];
    this.selectedOrderPointIds = new Set<string>();
    this.savingAssignments = false;
    this.loadingAssignments = false;
  }

  isAssignSelected(orderPointId: string): boolean {
    return this.selectedOrderPointIds.has(orderPointId);
  }

  toggleAssignSelection(orderPointId: string): void {
    if (this.selectedOrderPointIds.has(orderPointId)) {
      this.selectedOrderPointIds.delete(orderPointId);
    } else {
      this.selectedOrderPointIds.add(orderPointId);
    }
  }

  saveAssignments(): void {
    const cr = this.assignModalCashRegister;
    if (!cr?.id || this.savingAssignments) return;
    this.savingAssignments = true;
    const ids = Array.from(this.selectedOrderPointIds);
    this.eventService.setCashRegisterOrderPoints(cr.id, ids).subscribe({
      next: () => {
        this.savingAssignments = false;
        this.closeAssignModal();
      },
      error: (err) => {
        console.error('Error saving order point assignments:', err);
        this.savingAssignments = false;
        alert('Could not save assignments. Please try again.');
      }
    });
  }

}