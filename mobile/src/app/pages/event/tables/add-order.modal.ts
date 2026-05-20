import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonFooter,
  IonInput,
  IonItemDivider,
  IonBadge,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, addOutline, removeOutline, cartOutline } from 'ionicons/icons';
import { OrderService, MenuItem, EventOrderPoint, CreateOrderItem } from '../../../services/order.service';
import { RegistrationService } from '../../../services/registration.service';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

@Component({
  selector: 'app-add-order-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonSpinner,
    IonText,
    IonFooter,
    IonInput,
    IonItemDivider,
    IonBadge
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ table.orderPointName }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (menuItems.length === 0) {
        <div class="empty-state">
          <ion-text color="medium">
            <p>No menu items available</p>
          </ion-text>
        </div>
      } @else {
        <ion-list>
          @for (category of menuItems; track category.id) {
            <ion-item-divider>
              <ion-label>{{ category.name }}</ion-label>
            </ion-item-divider>
            @if (category.children && category.children.length > 0) {
              @for (item of category.children; track item.id) {
                @if (item.orderable) {
                  <ion-item>
                    <ion-label>
                      <h2>{{ item.name }}</h2>
                      <p>{{ item.price | currency:'RON':'symbol':'1.2-2' }}</p>
                    </ion-label>
                    <div class="quantity-controls" slot="end">
                      @if (getQuantity(item.id) > 0) {
                        <ion-button fill="clear" size="small" (click)="decreaseQuantity(item)">
                          <ion-icon name="remove-outline"></ion-icon>
                        </ion-button>
                        <span class="quantity">{{ getQuantity(item.id) }}</span>
                      }
                      <ion-button fill="clear" size="small" (click)="increaseQuantity(item)">
                        <ion-icon name="add-outline"></ion-icon>
                      </ion-button>
                    </div>
                  </ion-item>
                }
              }
            }
            @if (category.orderable) {
              <ion-item>
                <ion-label>
                  <h2>{{ category.name }}</h2>
                  <p>{{ category.price | currency:'RON':'symbol':'1.2-2' }}</p>
                </ion-label>
                <div class="quantity-controls" slot="end">
                  @if (getQuantity(category.id) > 0) {
                    <ion-button fill="clear" size="small" (click)="decreaseQuantity(category)">
                      <ion-icon name="remove-outline"></ion-icon>
                    </ion-button>
                    <span class="quantity">{{ getQuantity(category.id) }}</span>
                  }
                  <ion-button fill="clear" size="small" (click)="increaseQuantity(category)">
                    <ion-icon name="add-outline"></ion-icon>
                  </ion-button>
                </div>
              </ion-item>
            }
          }
        </ion-list>
      }
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <div class="footer-content">
          <div class="cart-summary">
            <ion-icon name="cart-outline"></ion-icon>
            <span>{{ getTotalItems() }} items</span>
            <span class="total">{{ getTotal() | currency:'RON':'symbol':'1.2-2' }}</span>
          </div>
          @if (registrationError) {
            <ion-text color="danger" class="registration-error">
              <p>{{ registrationError }}</p>
            </ion-text>
          }
          <ion-button
            [disabled]="cart.length === 0 || submitting || !registrationId"
            (click)="placeOrder()"
            expand="block"
          >
            @if (submitting) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              Place Order
            }
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .loading-container, .empty-state {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      padding: 24px;
    }

    ion-item-divider {
      --background: #f1f5f9;
      --color: #475569;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
    }

    ion-item h2 {
      font-weight: 500;
      font-size: 16px;
    }

    ion-item p {
      color: var(--ion-color-primary);
      font-weight: 600;
    }

    .quantity-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .quantity {
      min-width: 24px;
      text-align: center;
      font-weight: 600;
    }

    ion-footer ion-toolbar {
      --background: #ffffff;
      --border-color: #e2e8f0;
      --border-width: 1px 0 0 0;
      --border-style: solid;
      padding: 8px 16px;
    }

    .footer-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cart-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
    }

    .cart-summary .total {
      margin-left: auto;
      font-weight: 600;
      color: #1e293b;
      font-size: 18px;
    }

    ion-footer ion-button {
      --border-radius: 8px;
      margin: 0;
    }

    .registration-error p {
      margin: 0 0 4px;
      font-size: 13px;
    }
  `]
})
export class AddOrderModal implements OnInit {
  @Input() table!: EventOrderPoint;
  @Input() eventId!: string;

  menuItems: MenuItem[] = [];
  cart: CartItem[] = [];
  loading = true;
  submitting = false;
  registrationId: string | null = null;
  registrationError: string | null = null;

  constructor(
    private modalController: ModalController,
    private orderService: OrderService,
    private registrationService: RegistrationService
  ) {
    addIcons({ closeOutline, addOutline, removeOutline, cartOutline });
  }

  ngOnInit() {
    this.loadMenu();
    this.loadWaiterRegistration();
  }

  private loadWaiterRegistration() {
    this.registrationService.getMyWaiterRegistration(this.eventId).subscribe({
      next: (registration) => {
        this.registrationId = registration.id;
      },
      error: (err) => {
        console.error('Failed to load waiter registration:', err);
        this.registrationError = 'You are not assigned as a waiter for this event.';
      }
    });
  }

  loadMenu() {
    this.loading = true;
    this.orderService.getOrderPoint(this.table.orderPointId).subscribe({
      next: (orderPoint) => {
        if (orderPoint.menuId) {
          this.orderService.getMenuItems(orderPoint.menuId).subscribe({
            next: (items) => {
              this.menuItems = items;
              this.loading = false;
            },
            error: () => {
              this.loading = false;
            }
          });
        } else {
          this.loading = false;
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getQuantity(itemId: string): number {
    const cartItem = this.cart.find(c => c.menuItemId === itemId);
    return cartItem?.quantity || 0;
  }

  increaseQuantity(item: MenuItem) {
    const existing = this.cart.find(c => c.menuItemId === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1
      });
    }
  }

  decreaseQuantity(item: MenuItem) {
    const existing = this.cart.find(c => c.menuItemId === item.id);
    if (existing) {
      existing.quantity--;
      if (existing.quantity <= 0) {
        this.cart = this.cart.filter(c => c.menuItemId !== item.id);
      }
    }
  }

  getTotalItems(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotal(): number {
    return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  placeOrder() {
    if (this.cart.length === 0 || !this.registrationId) return;

    this.submitting = true;

    const orderItems: CreateOrderItem[] = this.cart.map(item => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));

    this.orderService.createOrder({
      registrationId: this.registrationId,
      orderPointId: this.table.orderPointId,
      payLater: true,
      orderItems
    }).subscribe({
      next: (order) => {
        this.submitting = false;
        this.modalController.dismiss({ success: true, order });
      },
      error: (err) => {
        this.submitting = false;
        console.error('Failed to create order:', err);
        this.modalController.dismiss({ success: false, error: err });
      }
    });
  }

  dismiss() {
    this.modalController.dismiss();
  }
}