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
import { closeOutline, addOutline, removeOutline, cartOutline, cashOutline, cardOutline, documentTextOutline } from 'ionicons/icons';
import { OrderService, MenuItem, EventOrderPoint, CreateOrderItem } from '../../../services/order.service';
import { RegistrationService } from '../../../services/registration.service';
import { AuthService } from '../../../services/auth.service';

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

    @if (paymentPickerOpen) {
      <div class="picker-backdrop" (click)="cancelPaymentPicker()">
        <div class="picker-sheet" (click)="$event.stopPropagation()">
          <div class="picker-head">
            <h3>Select Payment Method</h3>
            <ion-button fill="clear" size="small" (click)="cancelPaymentPicker()" [disabled]="submitting">
              <ion-icon name="close-outline" slot="icon-only"></ion-icon>
            </ion-button>
          </div>
          <div class="picker-summary">
            <span>{{ getTotalItems() }} {{ getTotalItems() === 1 ? 'item' : 'items' }}</span>
            <span class="picker-total">{{ getTotal() | currency:'RON':'symbol':'1.2-2' }}</span>
          </div>
          <div class="picker-methods">
            <button class="picker-btn cash" [disabled]="submitting" (click)="placeOrderWithPayment('CASH')">
              <ion-icon name="cash-outline"></ion-icon> Cash
            </button>
            <button class="picker-btn card" [disabled]="submitting" (click)="placeOrderWithPayment('CARD')">
              <ion-icon name="card-outline"></ion-icon> Card
            </button>
            <button class="picker-btn protocol" [disabled]="submitting" (click)="placeOrderWithPayment('PROTOCOL')">
              <ion-icon name="document-text-outline"></ion-icon> Protocol
            </button>
          </div>
        </div>
      </div>
    }
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

    .picker-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 1000;
    }

    .picker-sheet {
      width: 100%;
      max-width: 480px;
      background: #ffffff;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      padding: 16px 16px 24px;
      box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.12);
    }

    .picker-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .picker-head h3 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: #1e293b;
    }

    .picker-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 4px 16px;
      color: #475569;
      font-size: 14px;
    }

    .picker-summary .picker-total {
      font-weight: 600;
      color: #1e293b;
      font-size: 16px;
    }

    .picker-methods {
      display: flex;
      gap: 8px;
    }

    .picker-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px;
      border: 1px solid;
      background: transparent;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 0;
    }

    .picker-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .picker-btn ion-icon {
      font-size: 18px;
    }

    .picker-btn.cash {
      color: #16a34a;
      border-color: #16a34a;
    }

    .picker-btn.card {
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }

    .picker-btn.protocol {
      color: #b45309;
      border-color: #f59e0b;
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
  paymentPickerOpen = false;

  constructor(
    private modalController: ModalController,
    private orderService: OrderService,
    private registrationService: RegistrationService,
    private authService: AuthService
  ) {
    addIcons({ closeOutline, addOutline, removeOutline, cartOutline, cashOutline, cardOutline, documentTextOutline });
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
    if (this.cart.length === 0 || !this.registrationId || this.submitting) return;

    // Only non-pay-later OPs show the payment-method picker. Treat a
    // missing payLater flag as pay-later so the picker never appears
    // unless the OP is *explicitly* marked non-pay-later (defensive
    // against an older backend that hasn't been redeployed yet).
    if (this.table.payLater !== false) {
      this.createAndDismiss(true);
      return;
    }

    // Non-pay-later OPs: ask for the payment method first; the order is
    // created, settled, and moved to DELIVERED in one go.
    this.paymentPickerOpen = true;
  }

  cancelPaymentPicker() {
    if (this.submitting) return;
    this.paymentPickerOpen = false;
  }

  placeOrderWithPayment(method: 'CASH' | 'CARD' | 'PROTOCOL') {
    if (this.cart.length === 0 || !this.registrationId || this.submitting) return;

    this.submitting = true;
    const orderItems: CreateOrderItem[] = this.cart.map(item => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));

    // payLater=true creates the order as ACTIVE + needsPayment=true (the
    // bulk-paid call below clears needsPayment and triggers the fiscal
    // print for CASH/CARD; PROTOCOL skips the print backend-side).
    this.orderService.createOrder({
      registrationId: this.registrationId!,
      orderPointId: this.table.orderPointId,
      payLater: true,
      orderItems
    }).subscribe({
      next: (order) => {
        const operator = this.authService.getUserInfo()?.username || '';
        this.orderService.bulkMarkPaid({
          orderIds: [order.id],
          paymentMethod: method,
          paidBy: operator,
          cashRegisterDeviceId: this.table.cashRegisterId ?? null
        }).subscribe({
          next: () => {
            this.orderService.setOrderStatus(order.id, 'DELIVERED').subscribe({
              next: () => {
                this.submitting = false;
                this.paymentPickerOpen = false;
                this.modalController.dismiss({ success: true, order });
              },
              error: (err) => {
                // The order is paid; just couldn't auto-deliver. Surface
                // it as a success — the waiter can finish the move from
                // the kanban without losing the payment.
                console.error('Failed to mark order as DELIVERED:', err);
                this.submitting = false;
                this.paymentPickerOpen = false;
                this.modalController.dismiss({ success: true, order, deliveredFailed: true });
              }
            });
          },
          error: (err) => {
            console.error('Failed to mark order as paid:', err);
            this.submitting = false;
            // Leave the picker open so the waiter can retry; the order
            // exists in needs-payment and will be visible in Payments.
            this.modalController.dismiss({ success: false, error: err, order, paymentFailed: true });
          }
        });
      },
      error: (err) => {
        this.submitting = false;
        this.paymentPickerOpen = false;
        console.error('Failed to create order:', err);
        this.modalController.dismiss({ success: false, error: err });
      }
    });
  }

  private createAndDismiss(payLater: boolean) {
    this.submitting = true;

    const orderItems: CreateOrderItem[] = this.cart.map(item => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));

    this.orderService.createOrder({
      registrationId: this.registrationId!,
      orderPointId: this.table.orderPointId,
      payLater,
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