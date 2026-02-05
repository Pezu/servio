import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService, Client, PageResponse } from '../../clients/client.service';
import { LocationService, Location } from '../../clients/location.service';
import { MenuService, MenuItem } from '../../clients/menu.service';

@Component({
  selector: 'app-menu-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Menu Management</h1>
        <p class="text-muted">Select a client and location to manage menu items</p>
      </div>

      <div class="selectors-row">
        <div class="selector-group">
          <label>Client</label>
          <select class="form-control" [(ngModel)]="selectedClientId" (ngModelChange)="onClientChange()">
            <option value="">Select a client...</option>
            @for (client of clients; track client.id) {
              <option [value]="client.id">{{ client.name }}</option>
            }
          </select>
        </div>
        <div class="selector-group">
          <label>Location</label>
          <select class="form-control" [(ngModel)]="selectedLocationId" (ngModelChange)="onLocationChange()" [disabled]="!selectedClientId">
            <option value="">Select a location...</option>
            @for (location of locations; track location.id) {
              <option [value]="location.id">{{ location.name }}</option>
            }
          </select>
        </div>
      </div>

      @if (selectedLocationId) {
        <div class="card">
          <div class="card-header">
            <h3>Menu Items</h3>
            <button class="btn btn-primary btn-sm" (click)="addMenuItem()">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="btn-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          </div>
          <div class="card-body">
            @if (loadingMenu) {
              <div class="text-center py-4 text-muted">Loading menu...</div>
            } @else if (menuItems.length === 0) {
              <div class="text-center py-4 text-muted">No menu items yet. Add a category to get started.</div>
            } @else {
              <div class="menu-tree">
                @for (item of menuItems; track item.id || item.tempId) {
                  <div class="menu-item-row">
                    <div class="menu-item-content">
                      @if (!item.orderable) {
                        <button class="tree-toggle" (click)="toggleExpand(item)">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" [class.rotated]="isExpanded(item)">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      } @else {
                        <span class="tree-toggle-placeholder"></span>
                      }
                      <span class="menu-item-name" [class.category]="!item.orderable">{{ item.name }}</span>
                      @if (item.orderable && item.price) {
                        <span class="menu-item-price">{{ item.price | number:'1.2-2' }} RON</span>
                      }
                    </div>
                    <div class="menu-item-actions">
                      @if (!item.orderable) {
                        <button class="btn-icon-action btn-icon-action-sm" (click)="addChildItem(item)" title="Add Item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      }
                      <button class="btn-icon-action btn-icon-action-sm" (click)="editItem(item)" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button class="btn-icon-action btn-icon-action-sm btn-icon-delete" (click)="deleteItem(item)" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  @if (!item.orderable && isExpanded(item) && item.children?.length) {
                    <div class="menu-children">
                      @for (child of item.children; track child.id || child.tempId) {
                        <div class="menu-item-row child-item">
                          <div class="menu-item-content">
                            <span class="tree-toggle-placeholder"></span>
                            <span class="menu-item-name">{{ child.name }}</span>
                            @if (child.price) {
                              <span class="menu-item-price">{{ child.price | number:'1.2-2' }} RON</span>
                            }
                          </div>
                          <div class="menu-item-actions">
                            <button class="btn-icon-action btn-icon-action-sm" (click)="editItem(child, item)" title="Edit">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button class="btn-icon-action btn-icon-action-sm btn-icon-delete" (click)="deleteItem(child, item)" title="Delete">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            }
          </div>
          @if (menuItems.length > 0) {
            <div class="card-footer">
              <button class="btn btn-primary" (click)="saveMenu()" [disabled]="savingMenu">
                {{ savingMenu ? 'Saving...' : 'Save Menu' }}
              </button>
            </div>
          }
        </div>
      }
    </div>

    <!-- Menu Item Modal -->
    @if (showModal) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingItem ? 'Edit' : 'Add' }} {{ formData.orderable ? 'Item' : 'Category' }}</h3>
            <button class="close-btn" (click)="closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Name</label>
              <input type="text" class="form-control" [(ngModel)]="formData.name" placeholder="Enter name">
            </div>
            @if (formData.orderable) {
              <div class="form-group">
                <label>Price (RON)</label>
                <input type="number" step="0.01" class="form-control" [(ngModel)]="formData.price" placeholder="Enter price">
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea class="form-control" [(ngModel)]="formData.description" placeholder="Enter description" rows="3"></textarea>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveItem()" [disabled]="!formData.name.trim()">
              {{ editingItem ? 'Update' : 'Add' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-container { margin-bottom: 24px; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 8px 0; color: var(--text-dark); }
    .page-header p { margin: 0; }
    .text-muted { color: var(--text-muted); }

    .selectors-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .selector-group { flex: 1; }
    .selector-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: var(--text-dark); }
    .form-control { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-dark); background: #fff; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .form-control:disabled { background: var(--bg-light); cursor: not-allowed; }

    .card { background: var(--white); border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); overflow: hidden; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
    .card-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--text-dark); }
    .card-body { padding: 20px; }
    .card-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; }

    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 8px; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-secondary { background: var(--bg-light); color: var(--text-dark); }
    .btn-sm { padding: 8px 14px; font-size: 13px; }
    .btn-icon { width: 16px; height: 16px; }

    .menu-tree { border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
    .menu-item-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-color); }
    .menu-item-row:last-child { border-bottom: none; }
    .menu-item-row.child-item { padding-left: 48px; background: var(--bg-light); }
    .menu-children .menu-item-row:last-child { border-bottom: 1px solid var(--border-color); }
    .menu-item-content { display: flex; align-items: center; gap: 12px; }
    .menu-item-name { font-weight: 500; color: var(--text-dark); }
    .menu-item-name.category { font-weight: 600; }
    .menu-item-price { color: var(--text-muted); font-size: 13px; }
    .menu-item-actions { display: flex; gap: 4px; }

    .tree-toggle { width: 24px; height: 24px; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); padding: 0; }
    .tree-toggle svg { width: 14px; height: 14px; transition: transform 0.2s ease; }
    .tree-toggle svg.rotated { transform: rotate(90deg); }
    .tree-toggle-placeholder { width: 24px; }

    .btn-icon-action { width: 28px; height: 28px; border: none; background: var(--bg-light); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--text-muted); transition: all 0.15s ease; }
    .btn-icon-action:hover { background: var(--primary-light); color: var(--primary); }
    .btn-icon-action svg { width: 14px; height: 14px; }
    .btn-icon-action-sm { width: 26px; height: 26px; }
    .btn-icon-delete:hover { background: rgba(253, 84, 84, 0.1); color: var(--danger); }

    .py-4 { padding-top: 24px; padding-bottom: 24px; }
    .text-center { text-align: center; }

    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1050; }
    .modal { background: var(--white); border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-dark); }
    .close-btn { width: 32px; height: 32px; border: none; background: var(--bg-light); border-radius: 6px; font-size: 20px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .close-btn:hover { background: rgba(253, 84, 84, 0.1); color: var(--danger); }
    .modal-body { padding: 20px; }
    .modal-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--border-color); }
    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: var(--text-dark); }
    textarea.form-control { resize: vertical; min-height: 80px; }
  `]
})
export class MenuComponent implements OnInit {
  clients: Client[] = [];
  locations: Location[] = [];
  menuItems: MenuItem[] = [];

  selectedClientId = '';
  selectedLocationId = '';

  loadingMenu = false;
  savingMenu = false;
  showModal = false;
  editingItem: MenuItem | null = null;
  editingParent: MenuItem | null = null;

  formData: { name: string; orderable: boolean; price?: number; description?: string } = {
    name: '',
    orderable: false,
    price: undefined,
    description: ''
  };

  expandedNodes = new Set<string>();
  private tempIdCounter = 0;

  constructor(
    private clientService: ClientService,
    private locationService: LocationService,
    private menuService: MenuService
  ) {}

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.clientService.getClients(0, 100).subscribe({
      next: (response: PageResponse<Client>) => {
        this.clients = response.content;
      },
      error: (err) => console.error('Error loading clients:', err)
    });
  }

  onClientChange(): void {
    this.selectedLocationId = '';
    this.menuItems = [];
    if (this.selectedClientId) {
      this.loadLocations();
    } else {
      this.locations = [];
    }
  }

  loadLocations(): void {
    this.locationService.getLocationsByClientId(this.selectedClientId, 0, 100).subscribe({
      next: (response) => {
        this.locations = response.content;
      },
      error: (err) => console.error('Error loading locations:', err)
    });
  }

  onLocationChange(): void {
    if (this.selectedLocationId) {
      this.loadMenu();
    } else {
      this.menuItems = [];
    }
  }

  loadMenu(): void {
    this.loadingMenu = true;
    this.menuService.getMenuTree(this.selectedLocationId).subscribe({
      next: (items) => {
        this.menuItems = items;
        this.loadingMenu = false;
        // Expand all categories by default
        items.forEach(item => {
          if (!item.orderable && item.id) {
            this.expandedNodes.add(item.id);
          }
        });
      },
      error: (err) => {
        console.error('Error loading menu:', err);
        this.loadingMenu = false;
      }
    });
  }

  toggleExpand(item: MenuItem): void {
    const id = item.id || item.tempId;
    if (id) {
      if (this.expandedNodes.has(id)) {
        this.expandedNodes.delete(id);
      } else {
        this.expandedNodes.add(id);
      }
    }
  }

  isExpanded(item: MenuItem): boolean {
    const id = item.id || item.tempId;
    return id ? this.expandedNodes.has(id) : false;
  }

  addMenuItem(): void {
    this.editingItem = null;
    this.editingParent = null;
    this.formData = { name: '', orderable: false, price: undefined, description: '' };
    this.showModal = true;
  }

  addChildItem(parent: MenuItem): void {
    this.editingItem = null;
    this.editingParent = parent;
    this.formData = { name: '', orderable: true, price: undefined, description: '' };
    this.showModal = true;
  }

  editItem(item: MenuItem, parent?: MenuItem): void {
    this.editingItem = item;
    this.editingParent = parent || null;
    this.formData = {
      name: item.name,
      orderable: item.orderable,
      price: item.price,
      description: item.description || ''
    };
    this.showModal = true;
  }

  deleteItem(item: MenuItem, parent?: MenuItem): void {
    if (parent) {
      parent.children = parent.children.filter(c => c !== item);
    } else {
      this.menuItems = this.menuItems.filter(i => i !== item);
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.editingItem = null;
    this.editingParent = null;
  }

  saveItem(): void {
    if (!this.formData.name.trim()) return;

    if (this.editingItem) {
      // Update existing item
      this.editingItem.name = this.formData.name;
      this.editingItem.price = this.formData.price;
      this.editingItem.description = this.formData.description;
    } else {
      // Add new item
      const newItem: MenuItem = {
        tempId: `temp-${++this.tempIdCounter}`,
        name: this.formData.name,
        orderable: this.formData.orderable,
        price: this.formData.price,
        description: this.formData.description,
        children: []
      };

      if (this.editingParent) {
        if (!this.editingParent.children) {
          this.editingParent.children = [];
        }
        this.editingParent.children.push(newItem);
        // Expand parent to show new child
        const parentId = this.editingParent.id || this.editingParent.tempId;
        if (parentId) {
          this.expandedNodes.add(parentId);
        }
      } else {
        this.menuItems.push(newItem);
      }
    }

    this.closeModal();
  }

  saveMenu(): void {
    this.savingMenu = true;
    this.menuService.saveMenuTree(this.selectedLocationId, this.menuItems).subscribe({
      next: (items) => {
        this.menuItems = items;
        this.savingMenu = false;
      },
      error: (err) => {
        console.error('Error saving menu:', err);
        this.savingMenu = false;
      }
    });
  }
}