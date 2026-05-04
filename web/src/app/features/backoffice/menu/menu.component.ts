import { Component, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ClientService, Client } from '../clients/client.service';
import { LocationService, Location } from '../clients/location.service';
import { MenuService, MenuItem, Allergen, VatType, Menu } from '../clients/menu.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-client-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="page-container">
      <!-- Selectors Row -->
      <div class="selectors-row">
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
                  <input type="text" class="search-input" [placeholder]="'COMMON.SEARCH' | translate"
                    [(ngModel)]="searchTerm" (input)="onSearch()" (click)="$event.stopPropagation()">
                </div>
                <div class="client-list">
                  @if (loading) {
                    <div class="loading-state">{{ 'COMMON.LOADING' | translate }}</div>
                  }
                  @if (!loading && clients.length === 0) {
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
                @if (selectedLocationId) {
                  <div class="selected-location">
                    <svg class="location-pin-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span class="location-name">{{ selectedLocationName }}</span>
                  </div>
                }
                @if (!selectedLocationId) {
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
                    @if (filteredLocations.length === 0) {
                      <div class="empty-state">{{ 'LOCATIONS.NO_LOCATIONS' | translate }}</div>
                    }
                    @for (location of filteredLocations; track location) {
                      <div class="location-option"
                        [class.selected]="selectedLocationId === location.id"
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
    
        <!-- Menu Selector -->
        @if (selectedLocationId) {
          <div class="menu-selector-container">
            <label class="selector-label">Menu</label>
            <div class="selector-wrapper menu-wrapper" [class.open]="menuDropdownOpen">
              <div class="selector-input" (click)="toggleMenuDropdown()">
                @if (selectedMenuId) {
                  <div class="selected-menu">
                    <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span class="menu-name">{{ selectedMenuName }}</span>
                  </div>
                }
                @if (!selectedMenuId) {
                  <div class="placeholder">
                    Select menu
                  </div>
                }
                <span class="dropdown-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
    
              @if (menuDropdownOpen) {
                <div class="selector-dropdown">
                  <div class="menu-list">
                    @if (menus.length === 0) {
                      <div class="empty-state">No menus found</div>
                    }
                    @for (menu of menus; track menu) {
                      <div class="menu-option"
                        [class.selected]="selectedMenuId === menu.id"
                        (click)="selectMenu(menu)">
                        <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span class="menu-name">{{ menu.name }}</span>
                      </div>
                    }
                  </div>
                  <div class="dropdown-footer">
                    <button class="btn-create-menu" (click)="openCreateMenuModal(); $event.stopPropagation()" [title]="'MENU.CREATE_MENU' | translate">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    
      <!-- Menu Editor -->
      @if (canShowMenu) {
        <div class="menu-panel">
          <div class="card stretch">
            <div class="card-header">
              <h6 class="card-title">
                {{ 'MENU.MENU_ITEMS' | translate }}
                <span class="text-muted fw-normal">- {{ selectedLocationName }}</span>
              </h6>
              <div class="header-actions">
                <button class="action-btn" (click)="expandAll()" [title]="'MENU.EXPAND_ALL' | translate">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                <button class="action-btn" (click)="collapseAll()" [title]="'MENU.COLLAPSE_ALL' | translate">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                </button>
                <button class="action-btn action-btn-primary" (click)="addCategory()" [title]="'MENU.ADD_CATEGORY' | translate">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                @if (loadingMenu) {
                  <div class="text-center py-4 text-muted">{{ 'COMMON.LOADING' | translate }}</div>
                } @else if (menuItems.length === 0) {
                  <div class="text-center py-4 text-muted">{{ 'MENU.NO_MENU_ITEMS' | translate }}</div>
                } @else {
                  <div class="menu-tree">
                    <ng-container *ngTemplateOutlet="menuItemsTemplate; context: { items: menuItems, depth: 0, parent: null }"></ng-container>
                  </div>
                }
    
                <!-- Recursive Menu Items Template -->
                <ng-template #menuItemsTemplate let-items="items" let-depth="depth" let-parent="parent">
                  @for (item of items; track item.id || item.tempId) {
                    @if (!item.orderable) {
                      <!-- Category/Subcategory Row -->
                      <div class="menu-row category-row" [class.subcategory-row]="depth > 0">
                        <div class="menu-row-left">
                          <span class="indent-dynamic" [style.width.px]="depth * 24"></span>
                          <button class="expand-btn" (click)="toggleExpand(item)" [class.expanded]="isExpanded(item)">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <span class="category-icon" [class.subcategory-icon]="depth > 0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </span>
                          <span class="menu-name category-name" [innerHTML]="sanitizeHtml(item.name)"></span>
                          <span class="item-count">({{ item.children?.length || 0 }})</span>
                        </div>
                        <div class="menu-row-actions">
                          <button class="action-btn" (click)="addSubcategory(item)" [title]="'MENU.ADD_SUBCATEGORY' | translate">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </button>
                          <button class="action-btn" (click)="addItem(item)" [title]="'MENU.ADD_ITEM' | translate">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                          <button class="action-btn" (click)="editItem(item, parent)" [title]="'COMMON.EDIT' | translate">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button class="action-btn action-btn-delete" (click)="deleteItem(item, parent)" [title]="'COMMON.DELETE' | translate">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <!-- Recursively render children -->
                      @if (isExpanded(item) && item.children?.length) {
                        <ng-container *ngTemplateOutlet="menuItemsTemplate; context: { items: item.children, depth: depth + 1, parent: item }"></ng-container>
                      }
                    } @else {
                      <!-- Product/Item Row -->
                      <div class="menu-row item-row">
                        <div class="menu-row-left">
                          <span class="indent-dynamic" [style.width.px]="depth * 24"></span>
                          @if (item.imagePath) {
                            <img [src]="getImageUrl(item.imagePath)" class="item-image" alt="">
                          } @else {
                            <div class="item-image-placeholder">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          }
                          <div class="item-info">
                            <span class="menu-name" [innerHTML]="sanitizeHtml(item.name)"></span>
                            @if (item.description) {
                              <span class="item-description" [innerHTML]="sanitizeHtml(item.description)"></span>
                            }
                            @if (item.allergenIds?.length) {
                              <span class="item-allergens">{{ getAllergenNames(item.allergenIds) }}</span>
                            }
                          </div>
                        </div>
                        <div class="menu-row-right">
                          @if (item.price) {
                            <span class="item-price">{{ item.price | number:'1.2-2' }} RON</span>
                          }
                          <div class="custom-select vat-select-custom"
                               [class.open]="openVatDropdownId === item.id"
                               [class.disabled]="!item.id"
                               (click)="toggleVatDropdown(item, $event)">
                            <div class="custom-select-trigger">
                              <span class="selected-value">{{ getVatTypeLabel(item.vatTypeId) }}</span>
                              <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            @if (openVatDropdownId === item.id && item.id) {
                              <div class="custom-select-options square">
                                <div class="custom-select-option" [class.selected]="!item.vatTypeId" (click)="selectVatType(item, ''); $event.stopPropagation()">
                                  <span class="option-text">-</span>
                                  @if (!item.vatTypeId) {
                                    <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                  }
                                </div>
                                @for (vat of vatTypes; track vat.id) {
                                  <div class="custom-select-option" [class.selected]="item.vatTypeId === vat.id" (click)="selectVatType(item, vat.id!); $event.stopPropagation()">
                                    <span class="option-text">{{ vat.name }}</span>
                                    @if (item.vatTypeId === vat.id) {
                                      <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                      </svg>
                                    }
                                  </div>
                                }
                              </div>
                            }
                          </div>
                          <div class="menu-row-actions">
                            @if (item.id) {
                              <label class="image-upload-btn" [title]="'MENU.UPLOAD_IMAGE' | translate">
                                <input type="file" accept="image/*" (change)="uploadImage($event, item)" hidden>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </label>
                            } @else {
                              <button class="action-btn action-btn-disabled" [title]="'Save menu first to upload image'" disabled>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </button>
                            }
                            @if (item.imagePath) {
                              <button class="action-btn action-btn-delete" (click)="deleteImage(item)" [title]="'MENU.DELETE_IMAGE' | translate">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            }
                            <button class="action-btn" (click)="editItem(item, parent)" [title]="'COMMON.EDIT' | translate">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button class="action-btn action-btn-delete" (click)="deleteItem(item, parent)" [title]="'COMMON.DELETE' | translate">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    }
                  }
                </ng-template>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
    
    <!-- Menu Item Modal -->
    @if (showModal) {
      <div class="modal-overlay" (mousedown)="closeModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>
              @if (editingItem) {
                {{ 'COMMON.EDIT' | translate }} {{ getPlainText(editingItem.name) }}
              } @else {
                {{ 'COMMON.ADD' | translate }} {{ formData.orderable ? ('MENU.NEW_ITEM' | translate) : ('MENU.NEW_CATEGORY' | translate) }}
              }
            </h3>
            <button class="close-btn" (click)="closeModal()" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ 'COMMON.NAME' | translate }}</label>
              <div class="rich-text-toolbar">
                <button type="button" class="toolbar-btn" (click)="execCommand('bold')" title="Bold"><b>B</b></button>
                <button type="button" class="toolbar-btn" (click)="execCommand('italic')" title="Italic"><i>I</i></button>
                <button type="button" class="toolbar-btn" (click)="execCommand('underline')" title="Underline"><u>U</u></button>
                <span class="toolbar-separator"></span>
                <select class="toolbar-select" (change)="execCommandWithArg('fontSize', $event)">
                  <option value="">Size</option>
                  <option value="1">Small</option>
                  <option value="3">Normal</option>
                  <option value="5">Large</option>
                  <option value="7">X-Large</option>
                </select>
                <input type="color" class="toolbar-color" (input)="execCommandWithArg('foreColor', $event)" title="Text Color" value="#000000">
              </div>
              <div #nameEditor class="rich-text-editor" contenteditable="true"
                (input)="onNameInput($event)"
              (paste)="onPaste($event)"></div>
            </div>
            @if (formData.orderable) {
              <div class="form-group">
                <label>{{ 'COMMON.PRICE' | translate }} (RON)</label>
                <input type="number" step="0.01" class="form-control" [(ngModel)]="formData.price" placeholder="0.00">
              </div>
              <div class="form-group">
                <label>{{ 'COMMON.DESCRIPTION' | translate }}</label>
                <div class="rich-text-toolbar">
                  <button type="button" class="toolbar-btn" (click)="execCommand('bold', 'desc')" title="Bold"><b>B</b></button>
                  <button type="button" class="toolbar-btn" (click)="execCommand('italic', 'desc')" title="Italic"><i>I</i></button>
                  <button type="button" class="toolbar-btn" (click)="execCommand('underline', 'desc')" title="Underline"><u>U</u></button>
                  <span class="toolbar-separator"></span>
                  <select class="toolbar-select" (change)="execCommandWithArg('fontSize', $event, 'desc')">
                    <option value="">Size</option>
                    <option value="1">Small</option>
                    <option value="3">Normal</option>
                    <option value="5">Large</option>
                    <option value="7">X-Large</option>
                  </select>
                  <input type="color" class="toolbar-color" (input)="execCommandWithArg('foreColor', $event, 'desc')" title="Text Color" value="#000000">
                </div>
                <div #descEditor class="rich-text-editor rich-text-editor-multiline" contenteditable="true"
                  (input)="onDescInput($event)"
                (paste)="onPaste($event)"></div>
              </div>
              <div class="form-group">
                <label>{{ 'MENU.ALLERGENS' | translate }}</label>
                <div class="allergen-chips">
                  @for (allergen of allergens; track allergen.id) {
                    <label class="allergen-chip" [class.selected]="isAllergenSelected(allergen.id)">
                      <input type="checkbox" [checked]="isAllergenSelected(allergen.id)" (change)="toggleAllergen(allergen.id)">
                      <span class="allergen-number">{{ allergen.number }}</span>
                      <span class="allergen-name">{{ allergen.name }}</span>
                    </label>
                  }
                  @if (allergens.length === 0) {
                    <span class="text-muted">{{ 'MENU.NO_ALLERGENS' | translate }}</span>
                  }
                </div>
              </div>
              <div class="form-group">
                <label>{{ 'MENU.VAT_TYPE' | translate }}</label>
                <select class="form-control" [(ngModel)]="formData.vatTypeId">
                  <option value="">{{ 'MENU.SELECT_VAT_TYPE' | translate }}</option>
                  @for (vat of vatTypes; track vat.id) {
                    <option [value]="vat.id">{{ vat.name }}</option>
                  }
                </select>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="saveItem()" [disabled]="!formData.name.trim()">
              {{ 'COMMON.SAVE' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
    
    <!-- Create Menu Modal -->
    @if (showCreateMenuModal) {
      <div class="modal-overlay" (mousedown)="closeCreateMenuModal()">
        <div class="modal" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Create Menu</h3>
            <button class="close-btn" (click)="closeCreateMenuModal()" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Menu Name</label>
              <input type="text" class="form-control" [(ngModel)]="newMenuName" placeholder="Enter menu name">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeCreateMenuModal()">{{ 'COMMON.CANCEL' | translate }}</button>
            <button class="btn btn-primary" (click)="createMenu()" [disabled]="!newMenuName.trim()">
              Create
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

    .client-selector-container { display: flex; align-items: center; gap: 12px; }
    .selector-label { font-size: 14px; font-weight: 500; color: #374151; white-space: nowrap; }
    .selector-wrapper { position: relative; min-width: 300px; }
    .selector-input { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 0; background: white; cursor: pointer; transition: all 0.2s ease; }
    .selector-input:hover { border-color: #cbd5e1; }
    .selector-wrapper.open .selector-input { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .selected-client { display: flex; align-items: center; gap: 8px; }
    .placeholder { color: #94a3b8; }
    .dropdown-arrow { display: flex; align-items: center; color: #94a3b8; transition: transform 0.2s ease; }
    .dropdown-arrow svg { width: 18px; height: 18px; }
    .selector-wrapper.open .dropdown-arrow { transform: rotate(180deg); }
    .selector-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100; max-height: 350px; display: flex; flex-direction: column; }
    .search-box { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #e2e8f0; gap: 8px; }
    .search-icon { width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; }
    .search-input { flex: 1; border: none; outline: none; font-size: 14px; color: #374151; }
    .search-input::placeholder { color: #94a3b8; }
    .client-list { overflow-y: auto; max-height: 280px; }
    .loading-state, .empty-state { padding: 20px; text-align: center; color: #94a3b8; font-size: 14px; }
    .client-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s ease; }
    .client-option:hover { background: #f8fafc; }
    .client-option.selected { background: #eff6ff; }
    .client-info { display: flex; flex-direction: column; gap: 2px; }
    .client-name { font-size: 14px; font-weight: 500; color: #1e293b; }
    .client-details { font-size: 12px; color: var(--text-muted); }
    .status-bullet { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .bg-success { background-color: var(--success); }
    .bg-danger { background-color: var(--danger); }

    /* Location Selector Container */
    .location-selector-container { display: flex; align-items: center; gap: 12px; }
    .location-wrapper { min-width: 280px; }
    .location-list { overflow-y: auto; max-height: 280px; }
    .location-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s ease; }
    .location-option:hover { background: #f8fafc; }
    .location-option.selected { background: #eff6ff; }
    .location-option.sublocation { padding-left: 32px; }
    .location-pin-icon { width: 18px; height: 18px; color: var(--primary); flex-shrink: 0; }
    .selected-location { display: flex; align-items: center; gap: 8px; }
    .location-name { font-size: 14px; font-weight: 500; color: #1e293b; }

    /* Location Selector */
    .location-selector { display: flex; align-items: center; gap: 12px; }
    .form-select { padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-dark); background: white; min-width: 200px; }
    .form-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }

    /* Menu Selector Container */
    .menu-selector-container { display: flex; align-items: center; gap: 12px; }
    .menu-wrapper { min-width: 240px; }
    .menu-list { overflow-y: auto; max-height: 280px; }
    .menu-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s ease; }
    .menu-option:hover { background: #f8fafc; }
    .menu-option.selected { background: #eff6ff; }
    .menu-icon { width: 18px; height: 18px; color: var(--primary); flex-shrink: 0; }
    .selected-menu { display: flex; align-items: center; gap: 8px; }
    .menu-name { font-size: 14px; font-weight: 500; color: #1e293b; }
    .dropdown-footer { padding: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: center; }
    .btn-create-menu { width: 32px; height: 32px; padding: 0; border: 1px solid var(--primary); background: transparent; color: var(--primary); border-radius: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
    .btn-create-menu:hover { background: var(--primary-light); }
    .btn-create-menu svg { width: 16px; height: 16px; }
    .w-full { width: 100%; }

    /* Menu Panel */
    .menu-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .card { background: white; border-radius: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card.stretch { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(0, 0, 0, 0.08); flex-shrink: 0; flex-wrap: wrap; gap: 12px; }
    .card-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-dark); }
    .text-muted { color: var(--text-muted); }
    .fw-normal { font-weight: 400; }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .card-body { padding: 20px; }
    .card-body.p-0 { padding: 0 !important; flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .card-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; flex-shrink: 0; }
    .table-responsive { flex: 1; overflow-y: auto; min-height: 0; }
    .text-center { text-align: center; }
    .py-4 { padding: 24px 20px; }

    /* Buttons */
    .btn { padding: 8px 16px; border-radius: 0; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
    .btn svg { width: 16px; height: 16px; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .btn-sm svg { width: 14px; height: 14px; }
    .btn-primary { background: white; color: var(--primary); border-color: var(--primary); }
    .btn-primary:hover { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }
    .btn-primary:disabled { background: white; color: #94a3b8; border-color: #94a3b8; cursor: not-allowed; }
    .btn-secondary { background: white; color: #64748b; border-color: var(--border-color); }
    .btn-secondary:hover { background: white; color: #374151; border-color: #cbd5e1; }
    .btn-outline-secondary { background: transparent; color: #64748b; border-color: #e2e8f0; }
    .btn-outline-secondary:hover { background: #f8fafc; color: #374151; }

    /* Menu Tree */
    .menu-tree { }
    .menu-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border-color); transition: background 0.15s ease; }
    .menu-row:hover { background: var(--bg-light); }
    .menu-row:last-child { border-bottom: none; }

    .category-row { background: white; }
    .subcategory-row { background: white; }
    .item-row { }
    .item-row-deep { background: white; }

    .menu-row-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
    .menu-row-right { display: flex; align-items: center; gap: 16px; }
    .menu-row-actions { display: flex; gap: 4px; }

    .expand-btn { width: 24px; height: 24px; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); padding: 0; transition: transform 0.2s ease; flex-shrink: 0; }
    .expand-btn svg { width: 14px; height: 14px; }
    .expand-btn.expanded { transform: rotate(90deg); }

    .indent { width: 36px; flex-shrink: 0; }
    .indent-1 { width: 24px; flex-shrink: 0; }
    .indent-2 { width: 48px; flex-shrink: 0; }
    .indent-dynamic { flex-shrink: 0; }

    .category-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: #f59e0b; flex-shrink: 0; }
    .subcategory-icon { color: #94a3b8; }
    .category-icon svg { width: 20px; height: 20px; }

    .menu-name { font-size: 14px; color: var(--text-dark); }
    .category-name { font-weight: 600; }
    .item-count { font-size: 12px; color: var(--text-muted); margin-left: 4px; }

    .item-image { width: 48px; height: 48px; border-radius: 0; object-fit: cover; flex-shrink: 0; }
    .item-image-placeholder { width: 48px; height: 48px; border-radius: 0; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; flex-shrink: 0; }
    .item-image-placeholder svg { width: 24px; height: 24px; }

    .item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .item-description { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
    .item-allergens { font-size: 11px; color: #a0aec0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }

    .item-price { font-size: 14px; font-weight: 600; color: var(--text-dark); white-space: nowrap; }

    .action-btn { width: 32px; height: 32px; border: 1px solid rgba(0, 0, 0, 0.08); background: transparent; border-radius: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #64748b; transition: all 0.15s ease; }
    .action-btn:hover { background: rgba(0, 0, 0, 0.04); color: #374151; }
    .action-btn svg { width: 16px; height: 16px; }
    .action-btn-delete:hover { background: rgba(253, 106, 106, 0.1); color: var(--danger); border-color: rgba(253, 106, 106, 0.3); }
    .action-btn-primary { background: var(--primary); border-color: var(--primary); color: white; }
    .action-btn-primary:hover { background: #2563eb; border-color: #2563eb; color: white; }

    .image-upload-btn { width: 32px; height: 32px; border: 1px solid rgba(0, 0, 0, 0.08); background: transparent; border-radius: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #64748b; transition: all 0.15s ease; }
    .image-upload-btn:hover { background: rgba(0, 0, 0, 0.04); color: #374151; }
    .image-upload-btn svg { width: 16px; height: 16px; }
    .action-btn-disabled { opacity: 0.4; cursor: not-allowed; }
    .action-btn-disabled:hover { background: transparent; color: #64748b; }

    /* VAT Type custom dropdown */
    .custom-select { position: relative; cursor: pointer; }
    .custom-select-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 0 8px;
      height: 32px;
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 0;
      font-size: 13px;
      color: #64748b;
      transition: all 0.15s ease;
    }
    .custom-select:hover .custom-select-trigger { background: rgba(0, 0, 0, 0.04); color: #374151; }
    .custom-select.open .custom-select-trigger { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-light); color: var(--text-dark); }
    .custom-select.disabled { pointer-events: none; opacity: 0.4; }
    .custom-select .selected-value { display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .custom-select .dropdown-arrow { width: 14px; height: 14px; color: #94a3b8; transition: transform 0.2s ease; flex-shrink: 0; }
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
      max-height: 280px;
      overflow-y: auto;
    }
    .custom-select-options.open-upward { top: auto; bottom: calc(100% + 4px); }
    .custom-select-options.square,
    .custom-select-options.square .custom-select-option,
    .custom-select-options.square .custom-select-option:first-child,
    .custom-select-options.square .custom-select-option:last-child,
    .custom-select-options.square .custom-select-option:only-child { border-radius: 0; }
    .custom-select-option { display: flex; align-items: center; gap: 10px; padding: 8px 10px; font-size: 13px; color: var(--text-dark); cursor: pointer; transition: background 0.15s ease; }
    .custom-select-option:hover { background: var(--bg-light); }
    .custom-select-option.selected { background: rgba(59, 130, 246, 0.08); color: var(--primary); font-weight: 500; }
    .custom-select-option .option-text { flex: 1; }
    .custom-select-option .check-icon { width: 14px; height: 14px; color: var(--primary); margin-left: auto; }

    .custom-select.vat-select-custom { min-width: 90px; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 0; width: 100%; max-width: 480px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
    .modal-header h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; }
    .close-btn { width: 32px; height: 32px; border: 1px solid var(--border-color); background: transparent; border-radius: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; padding: 0; }
    .close-btn:hover { background: transparent; color: #374151; border-color: #cbd5e1; }
    .close-btn svg { width: 16px; height: 16px; display: block; }
    .modal-body { padding: 20px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid #e2e8f0; }
    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px; }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 0; font-size: 14px; color: var(--text-dark); }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    textarea.form-control { resize: vertical; min-height: 80px; }

    /* Allergen Chips */
    .allergen-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .allergen-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border-color); border-radius: 20px; cursor: pointer; transition: all 0.15s ease; background: white; }
    .allergen-chip:hover { border-color: var(--primary); background: var(--primary-light); }
    .allergen-chip.selected { border-color: var(--primary); background: var(--primary); color: white; }
    .allergen-chip input { display: none; }
    .allergen-number { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: var(--bg-light); border-radius: 50%; font-size: 11px; font-weight: 600; color: var(--text-muted); }
    .allergen-chip.selected .allergen-number { background: rgba(255, 255, 255, 0.2); color: white; }
    .allergen-name { font-size: 13px; font-weight: 500; }

    /* Rich Text Editor */
    .rich-text-toolbar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; background: #f8fafc; border: 1px solid var(--border-color); border-bottom: none; border-radius: 0; }
    .toolbar-btn { width: 28px; height: 28px; border: 1px solid transparent; background: transparent; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #64748b; transition: all 0.15s ease; }
    .toolbar-btn:hover { background: white; border-color: var(--border-color); color: #374151; }
    .toolbar-separator { width: 1px; height: 20px; background: var(--border-color); margin: 0 4px; }
    .toolbar-select { height: 28px; padding: 0 6px; border: 1px solid transparent; border-radius: 4px; font-size: 12px; color: #64748b; background: transparent; cursor: pointer; }
    .toolbar-select:hover { background: white; border-color: var(--border-color); }
    .toolbar-select:focus { outline: none; border-color: var(--primary); }
    .toolbar-color { width: 28px; height: 28px; padding: 2px; border: 1px solid transparent; border-radius: 4px; cursor: pointer; background: transparent; }
    .toolbar-color:hover { border-color: var(--border-color); }
    .rich-text-editor { min-height: 138px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 0; font-size: 14px; color: var(--text-dark); background: white; outline: none; overflow-wrap: break-word; word-wrap: break-word; }
    .rich-text-editor:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .rich-text-editor:empty:before { content: attr(data-placeholder); color: #94a3b8; }
    .rich-text-editor-multiline { min-height: 80px; }
  `]
})
export class ClientMenuComponent implements OnInit {
  clients: Client[] = [];
  selectedClient: Client | null = null;
  searchTerm = '';
  loading = false;
  dropdownOpen = false;

  // Role-based access
  hasRoleSuper = false;
  userClientId: string | null = null;

  locations: Location[] = [];
  selectedLocationId = '';
  locationDropdownOpen = false;
  locationSearchTerm = '';

  // Menu selection
  menus: Menu[] = [];
  selectedMenuId = '';
  menuDropdownOpen = false;
  showCreateMenuModal = false;
  newMenuName = '';

  menuItems: MenuItem[] = [];
  loadingMenu = false;
  savingMenu = false;
  hasChanges = false;

  expandedNodes = new Set<string>();
  private tempIdCounter = 0;

  showModal = false;
  editingItem: MenuItem | null = null;
  editingParent: MenuItem | null = null;
  formData = { name: '', orderable: false, price: 0, description: '', allergenIds: [] as string[], vatTypeId: '' };

  allergens: Allergen[] = [];
  vatTypes: VatType[] = [];

  @ViewChild('nameEditor') nameEditor!: ElementRef<HTMLDivElement>;
  @ViewChild('descEditor') descEditor!: ElementRef<HTMLDivElement>;

  private searchSubject = new Subject<string>();

  constructor(
    private clientService: ClientService,
    private locationService: LocationService,
    private menuService: MenuService,
    private elementRef: ElementRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.initUserRoles();
    this.loadClients();
    this.loadAllergens();
    this.loadVatTypes();
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(term => this.loadClients(term));
  }

  loadAllergens(): void {
    this.menuService.getActiveAllergens().subscribe({
      next: (allergens) => { this.allergens = allergens; },
      error: () => { this.allergens = []; }
    });
  }

  loadVatTypes(): void {
    this.menuService.getActiveVatTypes().subscribe({
      next: (vatTypes) => { this.vatTypes = vatTypes; },
      error: () => { this.vatTypes = []; }
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
    const clientSelector = this.elementRef.nativeElement.querySelector('.client-selector-container .selector-wrapper');
    if (clientSelector && !clientSelector.contains(event.target)) {
      this.dropdownOpen = false;
    }
    const locationSelector = this.elementRef.nativeElement.querySelector('.location-selector-container .selector-wrapper');
    if (locationSelector && !locationSelector.contains(event.target)) {
      this.locationDropdownOpen = false;
    }
    const menuSelector = this.elementRef.nativeElement.querySelector('.menu-selector-container .selector-wrapper');
    if (menuSelector && !menuSelector.contains(event.target)) {
      this.menuDropdownOpen = false;
    }
    if (this.openVatDropdownId) {
      const openVatDropdown = this.elementRef.nativeElement.querySelector('.vat-select-custom.open');
      if (openVatDropdown && !openVatDropdown.contains(event.target)) {
        this.openVatDropdownId = null;
      }
    }
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
    if (this.dropdownOpen) this.loadClients(this.searchTerm);
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
        error: () => { this.clients = []; this.loading = false; }
      });
    } else if (this.userClientId) {
      this.clientService.getClient(this.userClientId).subscribe({
        next: (client) => {
          this.clients = [client];
          this.loading = false;
          this.autoSelectIfSingleClient();
        },
        error: () => { this.clients = []; this.loading = false; }
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
    this.menuItems = [];
    this.hasChanges = false;
    this.selectedLocationId = '';
    this.loadLocations();
  }

  loadLocations(): void {
    if (!this.selectedClient?.id) return;
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
      },
      error: () => {}
    });
  }

  toggleLocationDropdown(): void {
    this.locationDropdownOpen = !this.locationDropdownOpen;
  }

  selectLocation(location: Location): void {
    this.selectedLocationId = location.id!;
    this.locationDropdownOpen = false;
    this.menuItems = [];
    this.hasChanges = false;
    this.selectedMenuId = '';
    this.menus = [];
    this.loadMenus();
  }

  onLocationChange(): void {
    this.menuItems = [];
    this.hasChanges = false;
    if (this.selectedLocationId) this.loadMenu();
  }

  get canShowMenu(): boolean {
    return !!this.selectedClient && !!this.selectedLocationId && !!this.selectedMenuId;
  }

  get selectedLocationName(): string {
    return this.locations.find(l => l.id === this.selectedLocationId)?.name || '';
  }

  get filteredLocations(): Location[] {
    if (!this.locationSearchTerm.trim()) return this.locations;
    const term = this.locationSearchTerm.toLowerCase();
    return this.locations.filter(l => l.name.toLowerCase().includes(term));
  }

  onLocationSearch(): void {
    // Filtering is handled reactively by the getter
  }

  // Menu selector methods
  toggleMenuDropdown(): void {
    this.menuDropdownOpen = !this.menuDropdownOpen;
  }

  selectMenu(menu: Menu): void {
    this.selectedMenuId = menu.id!;
    this.menuDropdownOpen = false;
    this.menuItems = [];
    this.hasChanges = false;
    this.loadMenu();
  }

  get selectedMenuName(): string {
    return this.menus.find(m => m.id === this.selectedMenuId)?.name || '';
  }

  openCreateMenuModal(): void {
    this.menuDropdownOpen = false;
    this.newMenuName = '';
    this.showCreateMenuModal = true;
  }

  closeCreateMenuModal(): void {
    this.showCreateMenuModal = false;
    this.newMenuName = '';
  }

  createMenu(): void {
    if (!this.newMenuName.trim() || !this.selectedLocationId) return;
    this.menuService.createMenu(this.selectedLocationId, this.newMenuName.trim()).subscribe({
      next: (menu) => {
        this.menus.push(menu);
        this.selectedMenuId = menu.id!;
        this.closeCreateMenuModal();
        this.menuItems = [];
        this.hasChanges = false;
      },
      error: (err) => console.error('Error creating menu:', err)
    });
  }

  loadMenus(): void {
    if (!this.selectedLocationId) return;
    this.menuService.getMenusByLocation(this.selectedLocationId).subscribe({
      next: (menus) => {
        this.menus = menus;
        // Auto-select first menu if available
        if (menus.length > 0 && !this.selectedMenuId) {
          this.selectedMenuId = menus[0].id!;
          this.loadMenu();
        } else if (menus.length === 0) {
          this.menuItems = [];
        }
      },
      error: () => { this.menus = []; }
    });
  }

  loadMenu(): void {
    if (!this.selectedMenuId) return;
    this.loadingMenu = true;
    this.menuService.getMenuTreeByMenuId(this.selectedMenuId).subscribe({
      next: (items) => {
        this.menuItems = items;
        this.loadingMenu = false;
        this.expandedNodes.clear();
        items.forEach(item => {
          if (!item.orderable && item.id) this.expandedNodes.add(item.id);
        });
      },
      error: () => { this.menuItems = []; this.loadingMenu = false; }
    });
  }

  toggleExpand(item: MenuItem): void {
    const id = item.id || item.tempId;
    if (id) {
      if (this.expandedNodes.has(id)) this.expandedNodes.delete(id);
      else this.expandedNodes.add(id);
    }
  }

  isExpanded(item: MenuItem): boolean {
    const id = item.id || item.tempId;
    return id ? this.expandedNodes.has(id) : false;
  }

  expandAll(): void {
    this.expandItemsRecursively(this.menuItems);
  }

  private expandItemsRecursively(items: MenuItem[]): void {
    items.forEach(item => {
      const id = item.id || item.tempId;
      if (id && !item.orderable) {
        this.expandedNodes.add(id);
        if (item.children?.length) {
          this.expandItemsRecursively(item.children);
        }
      }
    });
  }

  collapseAll(): void {
    this.expandedNodes.clear();
  }

  addCategory(): void {
    this.editingItem = null;
    this.editingParent = null;
    this.formData = { name: '', orderable: false, price: 0, description: '', allergenIds: [], vatTypeId: '' };
    this.showModal = true;
    this.setEditorContent();
  }

  addSubcategory(parent: MenuItem): void {
    this.editingItem = null;
    this.editingParent = parent;
    this.formData = { name: '', orderable: false, price: 0, description: '', allergenIds: [], vatTypeId: '' };
    this.showModal = true;
    this.setEditorContent();
  }

  addItem(parent: MenuItem): void {
    this.editingItem = null;
    this.editingParent = parent;
    this.formData = { name: '', orderable: true, price: 0, description: '', allergenIds: [], vatTypeId: '' };
    this.showModal = true;
    this.setEditorContent();
  }

  editItem(item: MenuItem, parent?: MenuItem): void {
    this.editingItem = item;
    this.editingParent = parent || null;
    this.formData = { name: item.name, orderable: item.orderable, price: item.price || 0, description: item.description || '', allergenIds: [...(item.allergenIds || [])], vatTypeId: item.vatTypeId || '' };
    this.showModal = true;
    this.setEditorContent();
  }

  isAllergenSelected(allergenId: string): boolean {
    return this.formData.allergenIds.includes(allergenId);
  }

  toggleAllergen(allergenId: string): void {
    const index = this.formData.allergenIds.indexOf(allergenId);
    if (index === -1) {
      this.formData.allergenIds.push(allergenId);
    } else {
      this.formData.allergenIds.splice(index, 1);
    }
  }

  deleteItem(item: MenuItem, parent?: MenuItem): void {
    if (parent) parent.children = parent.children.filter(c => c !== item);
    else this.menuItems = this.menuItems.filter(i => i !== item);
    this.saveMenu();
  }

  onVatTypeChange(item: MenuItem, vatTypeId: string): void {
    item.vatTypeId = vatTypeId || undefined;
    this.saveMenu();
  }

  openVatDropdownId: string | null = null;

  toggleVatDropdown(item: MenuItem, event: Event): void {
    event.stopPropagation();
    if (!item.id) return;
    this.openVatDropdownId = this.openVatDropdownId === item.id ? null : item.id;
  }

  selectVatType(item: MenuItem, vatTypeId: string): void {
    this.openVatDropdownId = null;
    this.onVatTypeChange(item, vatTypeId);
  }

  getVatTypeLabel(vatTypeId?: string): string {
    if (!vatTypeId) return '-';
    const vat = this.vatTypes.find(v => v.id === vatTypeId);
    return vat?.name || '-';
  }

  getPlainText(html: string | undefined | null): string {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  closeModal(): void {
    this.showModal = false;
    this.editingItem = null;
    this.editingParent = null;
  }

  saveItem(): void {
    if (!this.formData.name.trim()) return;

    if (this.editingItem) {
      this.editingItem.name = this.formData.name;
      this.editingItem.price = this.formData.orderable ? this.formData.price : undefined;
      this.editingItem.description = this.formData.description;
      this.editingItem.allergenIds = this.formData.orderable ? [...this.formData.allergenIds] : [];
      this.editingItem.vatTypeId = this.formData.orderable ? this.formData.vatTypeId || undefined : undefined;
    } else {
      const newItem: MenuItem = {
        tempId: `temp-${++this.tempIdCounter}`,
        name: this.formData.name,
        orderable: this.formData.orderable,
        price: this.formData.orderable ? this.formData.price : undefined,
        description: this.formData.description,
        children: [],
        allergenIds: this.formData.orderable ? [...this.formData.allergenIds] : [],
        vatTypeId: this.formData.orderable ? this.formData.vatTypeId || undefined : undefined
      };

      if (this.editingParent) {
        if (!this.editingParent.children) this.editingParent.children = [];
        this.editingParent.children.push(newItem);
        const parentId = this.editingParent.id || this.editingParent.tempId;
        if (parentId) this.expandedNodes.add(parentId);
      } else {
        this.menuItems.push(newItem);
      }
    }

    this.closeModal();
    this.saveMenu();
  }

  saveMenu(): void {
    if (!this.selectedMenuId) return;
    this.savingMenu = true;
    this.menuService.saveMenuTreeByMenuId(this.selectedMenuId, this.menuItems).subscribe({
      next: (items) => { this.menuItems = items; this.savingMenu = false; this.hasChanges = false; },
      error: () => { this.savingMenu = false; }
    });
  }

  getImageUrl(imagePath: string): string {
    return this.menuService.getImageUrl(imagePath);
  }

  getAllergenNames(allergenIds: string[]): string {
    if (!allergenIds?.length) return '';
    return allergenIds
      .map(id => this.allergens.find(a => a.id === id))
      .filter(a => a)
      .map(a => `${a!.number}. ${a!.name}`)
      .join(', ');
  }

  uploadImage(event: Event, item: MenuItem): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !item.id) return;

    const file = input.files[0];
    this.menuService.uploadImage(item.id, file).subscribe({
      next: (updated) => { item.imagePath = updated.imagePath; },
      error: (err) => console.error('Error uploading image:', err)
    });
    input.value = '';
  }

  deleteImage(item: MenuItem): void {
    if (!item.id) return;
    this.menuService.deleteImage(item.id).subscribe({
      next: () => { item.imagePath = undefined; },
      error: (err) => console.error('Error deleting image:', err)
    });
  }

  // Rich text editor methods
  private setEditorContent(): void {
    // Use setTimeout to wait for the modal to render
    setTimeout(() => {
      if (this.nameEditor?.nativeElement) {
        this.nameEditor.nativeElement.innerHTML = this.formData.name || '';
      }
      if (this.descEditor?.nativeElement) {
        this.descEditor.nativeElement.innerHTML = this.formData.description || '';
      }
    }, 0);
  }

  execCommand(command: string, target: string = 'name'): void {
    document.execCommand(command, false);
    if (target === 'name') {
      this.nameEditor?.nativeElement?.focus();
    } else {
      this.descEditor?.nativeElement?.focus();
    }
  }

  execCommandWithArg(command: string, event: Event, target: string = 'name'): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    if (value) {
      document.execCommand(command, false, value);
    }
    if (target === 'name') {
      this.nameEditor?.nativeElement?.focus();
    } else {
      this.descEditor?.nativeElement?.focus();
    }
  }

  onNameInput(event: Event): void {
    const element = event.target as HTMLDivElement;
    this.formData.name = element.innerHTML;
  }

  onDescInput(event: Event): void {
    const element = event.target as HTMLDivElement;
    this.formData.description = element.innerHTML;
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }
}