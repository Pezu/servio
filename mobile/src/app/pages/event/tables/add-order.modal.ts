import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonFooter,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, addOutline, removeOutline, cartOutline, cashOutline, cardOutline, documentTextOutline, arrowBackOutline, folderOutline } from 'ionicons/icons';
import { OrderService, MenuItem, Menu, EventOrderPoint, CreateOrderItem } from '../../../services/order.service';
import { RegistrationService } from '../../../services/registration.service';
import { AuthService } from '../../../services/auth.service';
import { EventService } from '../../../services/event.service';

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
    IonSpinner,
    IonText,
    IonFooter
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          @if (categoryStack.length > 0 || summaryOpen) {
            <ion-button (click)="goBack()">
              <ion-icon name="arrow-back-outline" slot="icon-only"></ion-icon>
            </ion-button>
          } @else {
            <span class="header-table" [innerHTML]="safeHtml(table.orderPointName)"></span>
          }
        </ion-buttons>
        <ion-title>
          @if (summaryOpen) {
            <span>Order Summary</span>
          } @else if (categoryStack.length > 0) {
            <span [innerHTML]="currentTitle()"></span>
          } @else if (menus.length > 1) {
            <select class="menu-select" [(ngModel)]="selectedMenuId" (ngModelChange)="onMenuChange()">
              @for (m of menus; track m.id) {
                <option [ngValue]="m.id">{{ m.name }}</option>
              }
            </select>
          } @else if (selectedMenu) {
            <span class="header-menu">{{ selectedMenu.name }}</span>
          }
        </ion-title>
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
      } @else if (summaryOpen) {
        <div class="summary-view">
          @if (cart.length === 0) {
            <div class="empty-state">
              <ion-text color="medium">
                <p>Cart is empty</p>
              </ion-text>
            </div>
          } @else {
            <ul class="summary-list">
              @for (line of cart; track line.menuItemId) {
                <li class="summary-line">
                  <div class="summary-stepper">
                    <button type="button" class="step-btn" aria-label="Decrease" (click)="decrementLine(line)">−</button>
                    <span class="step-qty">{{ line.quantity }}</span>
                    <button type="button" class="step-btn" aria-label="Increase" (click)="incrementLine(line)">+</button>
                  </div>
                  <span class="summary-name" [innerHTML]="safeHtml(line.name)"></span>
                  <span class="summary-each">{{ line.price | currency:'RON':'symbol':'1.2-2' }}</span>
                  <span class="summary-line-total">{{ (line.price * line.quantity) | currency:'RON':'symbol':'1.2-2' }}</span>
                </li>
              }
            </ul>
            <div class="summary-total-row">
              <span>Total</span>
              <span class="summary-total">{{ getTotal() | currency:'RON':'symbol':'1.2-2' }}</span>
            </div>
          }
        </div>
      } @else if (menuItems.length === 0) {
        <div class="empty-state">
          <ion-text color="medium">
            <p>No menu items available</p>
          </ion-text>
        </div>
      } @else if (currentItems().length === 0) {
        <div class="empty-state">
          <ion-text color="medium">
            <p>Nothing in this category</p>
          </ion-text>
        </div>
      } @else {
        <div class="menu-grid">
          @for (item of currentItems(); track item.id) {
            <button
              type="button"
              class="menu-tile"
              [class.is-category]="isCategory(item)"
              [class.is-product]="!isCategory(item) && item.orderable"
              [class.is-disabled]="!isCategory(item) && !item.orderable"
              (click)="tapTile(item)"
            >
              @if (getQuantity(item.id) > 0) {
                <span
                  class="qty-decrement"
                  role="button"
                  aria-label="Remove one"
                  (click)="decrementTile(item, $event)"
                >−</span>
                <span class="qty-badge">{{ getQuantity(item.id) }}</span>
              }
              @if (isCategory(item)) {
                <ion-icon name="folder-outline" class="tile-icon"></ion-icon>
              }
              <span class="tile-name" [innerHTML]="safeHtml(item.name)"></span>
              @if (!isCategory(item) && item.orderable) {
                <span class="tile-price">{{ item.price | currency:'RON':'symbol':'1.2-2' }}</span>
              }
            </button>
          }
        </div>
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
          @if (summaryOpen) {
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
          } @else {
            <ion-button
              [disabled]="cart.length === 0 || submitting || !registrationId"
              (click)="openSummary()"
              expand="block"
            >
              View Summary
            </ion-button>
          }
        </div>
      </ion-toolbar>
    </ion-footer>

    @if (paymentPickerOpen) {
      <div class="picker-backdrop" (click)="cancelPaymentPicker()">
        <div class="picker-sheet" (click)="$event.stopPropagation()">
          <div class="picker-head">
            <h3>{{ pendingReceipt ? 'Confirm' : 'Order' }}</h3>
            <ion-button fill="clear" size="small" (click)="cancelPaymentPicker()" [disabled]="submitting">
              <ion-icon name="close-outline" slot="icon-only"></ion-icon>
            </ion-button>
          </div>
          <div class="picker-summary">
            <span>{{ getTotalItems() }} {{ getTotalItems() === 1 ? 'item' : 'items' }}</span>
            <span class="picker-total">{{ getTotal() | currency:'RON':'symbol':'1.2-2' }}</span>
          </div>

          @if (!pendingReceipt) {
            <div class="picker-section-label">Tip</div>
            <div class="tip-row">
              <button class="tip-chip" [class.active]="tipMode === 'none'" [disabled]="submitting" (click)="selectTipMode('none')">None</button>
              <button class="tip-chip" [class.active]="tipMode === 'p10'" [disabled]="submitting" (click)="selectTipMode('p10')">10%</button>
              <button class="tip-chip" [class.active]="tipMode === 'p12'" [disabled]="submitting" (click)="selectTipMode('p12')">12%</button>
              <button class="tip-chip" [class.active]="tipMode === 'p15'" [disabled]="submitting" (click)="selectTipMode('p15')">15%</button>
              <button class="tip-chip" [class.active]="tipMode === 'customPct'" [disabled]="submitting" (click)="selectTipMode('customPct')">Custom %</button>
              <button class="tip-chip" [class.active]="tipMode === 'customAmt'" [disabled]="submitting" (click)="selectTipMode('customAmt')">Custom RON</button>
            </div>
            @if (tipMode === 'customPct') {
              <div class="tip-input-row">
                <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="Percent"
                  [(ngModel)]="tipCustomPercent" [disabled]="submitting" />
                <span class="tip-input-suffix">%</span>
              </div>
            }
            @if (tipMode === 'customAmt') {
              <div class="tip-input-row">
                <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="Amount"
                  [(ngModel)]="tipCustomAmount" [disabled]="submitting" />
                <span class="tip-input-suffix">RON</span>
              </div>
            }
            <div class="tip-summary">
              <span class="tip-summary-label">Tip</span>
              <span class="tip-summary-value">{{ computedTip() | currency:'RON':'symbol':'1.2-2' }}</span>
            </div>
            <div class="tip-summary total">
              <span class="tip-summary-label">Total to pay</span>
              <span class="tip-summary-value">{{ totalWithTip() | currency:'RON':'symbol':'1.2-2' }}</span>
            </div>
            <div class="picker-methods">
              @if (eventCard) {
                <button class="picker-btn order" [disabled]="submitting" (click)="askOrderReceipt('CARD')">
                  Order
                </button>
              } @else {
                <button class="picker-btn cash" [disabled]="submitting" (click)="askOrderReceipt('CASH')">
                  Cash
                </button>
                <button class="picker-btn card" [disabled]="submitting" (click)="askOrderReceipt('CARD')">
                  Card
                </button>
              }
            </div>
          } @else {
            <div class="receipt-confirm">
              <div class="receipt-confirm-question">Get receipt from cash register?</div>
              <div class="receipt-confirm-row">
                <button class="receipt-btn no" [disabled]="submitting" (click)="cancelPaymentPicker()">No</button>
                <button class="receipt-btn yes" [disabled]="submitting" (click)="confirmOrderReceiptYes()">
                  @if (submitting) {
                    <ion-spinner name="crescent"></ion-spinner>
                  } @else {
                    Yes
                  }
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Header: table name (left) · menu switcher (center) · close (right) */
    .header-table {
      display: inline-block;
      max-width: 36vw;
      padding-left: 12px;
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-menu {
      font-size: 16px;
      font-weight: 700;
    }
    .menu-select {
      max-width: 70vw;
      background: transparent;
      color: inherit;
      border: none;
      border-bottom: 1px solid currentColor;
      font-size: 16px;
      font-weight: 700;
      font-family: inherit;
      padding: 1px 20px 1px 6px;
      text-align: center;
      text-align-last: center;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3'><path d='M6 9l6 6 6-6'/></svg>");
      background-repeat: no-repeat;
      background-position: right 2px center;
    }
    .menu-select option {
      color: #1e293b;
      font-weight: 600;
    }

    .loading-container, .empty-state {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      padding: 24px;
    }

    .menu-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      padding: 10px;
    }

    .summary-view {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .summary-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    .summary-line {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      column-gap: 10px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
      color: #1e293b;
    }

    .summary-line:last-child {
      border-bottom: none;
    }

    .summary-stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--ion-color-primary);
    }

    .summary-stepper .step-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: var(--ion-color-primary);
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-family: inherit;
    }

    .summary-stepper .step-qty {
      min-width: 26px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
    }

    .summary-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .summary-name font[size="1"] {
      font-size: 11px;
      font-weight: 500;
      opacity: 0.7;
      margin-left: 4px;
    }

    .summary-each {
      font-size: 12px;
      color: #64748b;
      font-variant-numeric: tabular-nums;
    }

    .summary-line-total {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .summary-total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }

    .summary-total {
      font-variant-numeric: tabular-nums;
    }

    .menu-tile {
      position: relative;
      aspect-ratio: 1 / 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 8px;
      background: #ffffff;
      border: 1px solid var(--ion-color-primary);
      color: var(--ion-color-primary);
      border-radius: 0;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .menu-tile.is-category {
      border-color: #94a3b8;
      color: #1e293b;
      background: #f8fafc;
    }

    .menu-tile.is-disabled {
      border-color: #e2e8f0;
      color: #94a3b8;
      cursor: not-allowed;
    }

    .menu-tile:active {
      background: var(--ion-color-primary);
      color: #ffffff;
    }

    .menu-tile.is-category:active {
      background: #e2e8f0;
      color: #1e293b;
    }

    .tile-icon {
      font-size: 28px;
      opacity: 0.65;
    }

    .tile-name {
      display: block;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      word-break: break-word;
    }

    .tile-name font[size="1"] {
      font-size: 11px;
      font-weight: 500;
      opacity: 0.75;
    }

    .tile-price {
      font-size: 12px;
      font-weight: 700;
      opacity: 0.85;
    }

    .qty-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: transparent;
      border: 1px solid var(--ion-color-primary);
      color: var(--ion-color-primary);
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .qty-decrement {
      position: absolute;
      top: 0;
      left: 0;
      width: 30%;
      aspect-ratio: 1 / 1;
      border-radius: 0;
      background: transparent;
      border: 1px solid #ef4444;
      color: #ef4444;
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      user-select: none;
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

    .picker-btn.order {
      flex: 1;
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }

    .picker-section-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      padding: 12px 0 6px;
    }

    .tip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tip-chip {
      flex: 1 0 calc(33.333% - 6px);
      min-width: 64px;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      background: transparent;
      color: #475569;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 0;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }

    .tip-chip:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .tip-chip.active {
      border-color: var(--ion-color-primary);
      color: var(--ion-color-primary);
      background: rgba(59, 130, 246, 0.08);
    }

    .tip-input-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-top: 10px;
    }

    .tip-input-row input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 0;
      font-size: 14px;
      background: #ffffff;
      color: #1e293b;
      outline: none;
    }

    .tip-input-row input:focus {
      border-color: var(--ion-color-primary);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
    }

    .tip-input-suffix {
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      min-width: 36px;
      text-align: left;
    }

    .tip-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 8px;
      color: #475569;
      font-size: 13px;
    }

    .tip-summary.total {
      padding-top: 6px;
      padding-bottom: 4px;
      color: #1e293b;
      font-size: 15px;
      font-weight: 700;
    }

    .receipt-confirm {
      padding: 16px 0 4px;
    }

    .receipt-confirm-question {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      text-align: center;
      padding-bottom: 14px;
    }

    .receipt-confirm-row {
      display: flex;
      gap: 8px;
    }

    .receipt-btn {
      flex: 1;
      padding: 14px;
      border: 1px solid;
      background: transparent;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border-radius: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .receipt-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .receipt-btn.no {
      color: #475569;
      border-color: #cbd5e1;
    }

    .receipt-btn.yes {
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }
  `]
})
export class AddOrderModal implements OnInit {
  @Input() table!: EventOrderPoint;
  @Input() eventId!: string;

  menuItems: MenuItem[] = [];
  /** All menus defined for the event (its location), for the header switcher. */
  menus: Menu[] = [];
  /** Currently displayed menu. Defaults to the order point's own menu. */
  selectedMenuId: string | null = null;
  cart: CartItem[] = [];
  loading = true;
  submitting = false;
  registrationId: string | null = null;
  registrationError: string | null = null;
  paymentPickerOpen = false;
  /**
   * Inside the picker sheet, swap the tip view for the
   * "Get receipt from cash register?" Yes/No prompt.
   */
  pendingReceipt = false;

  // Tip selector (mirrors the Payments tab).
  tipMode: 'none' | 'p10' | 'p12' | 'p15' | 'customPct' | 'customAmt' = 'none';
  tipCustomPercent: number | null = null;
  tipCustomAmount: number | null = null;

  /**
   * Event "card" flag. true → non-pay-later orders settle as CARD only (the
   * single "Order" button); false → the waiter picks Cash or Card. Defaults
   * true so behaviour is unchanged until the event resolves.
   */
  eventCard = true;

  /** Method chosen on the non-pay-later picker, carried into the receipt step. */
  pendingMethod: 'CASH' | 'CARD' = 'CARD';

  /**
   * Drill-down path inside the menu tree. Empty array = at the menu root.
   * Pushing a category navigates into it; popping returns to the parent.
   */
  categoryStack: MenuItem[] = [];

  /**
   * After tapping View Summary in the footer, swap the menu body for an
   * order summary and turn the footer button into Place Order. Header
   * back arrow returns to the menu.
   */
  summaryOpen = false;

  private readonly safeHtmlCache = new Map<string, SafeHtml>();

  constructor(
    private modalController: ModalController,
    private orderService: OrderService,
    private registrationService: RegistrationService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private eventService: EventService
  ) {
    addIcons({
      closeOutline,
      addOutline,
      removeOutline,
      cartOutline,
      cashOutline,
      cardOutline,
      documentTextOutline,
      arrowBackOutline,
      folderOutline
    });
  }

  ngOnInit() {
    this.initMenus();
    this.loadWaiterRegistration();
  }

  /**
   * Resolve the order point's default menu and the full list of menus for the
   * event (its location), then load the default menu's items. The header
   * dropdown lets the waiter switch between any of the event's menus.
   */
  private initMenus() {
    this.loading = true;
    this.orderService.getOrderPoint(this.table.orderPointId).subscribe({
      next: (orderPoint) => {
        const defaultMenuId = orderPoint.menuId || null;
        this.eventService.getMyActiveEvents().subscribe({
          next: (events) => {
            const ev = events.find(e => e.id === this.eventId);
            // card=true → non-pay-later orders settle CARD only (current default);
            // card=false → the waiter picks Cash or Card.
            this.eventCard = ev?.card ?? true;
            const locationId = ev?.locationId;
            if (!locationId) {
              this.selectedMenuId = defaultMenuId;
              this.loadMenuItems();
              return;
            }
            this.orderService.getMenusByLocation(locationId).subscribe({
              next: (menus) => {
                this.menus = menus || [];
                this.selectedMenuId = defaultMenuId && this.menus.some(m => m.id === defaultMenuId)
                  ? defaultMenuId
                  : (this.menus[0]?.id ?? defaultMenuId);
                this.loadMenuItems();
              },
              error: () => { this.selectedMenuId = defaultMenuId; this.loadMenuItems(); }
            });
          },
          error: () => { this.selectedMenuId = defaultMenuId; this.loadMenuItems(); }
        });
      },
      error: () => { this.loading = false; }
    });
  }

  /** Load the items of the currently selected menu. */
  loadMenuItems() {
    if (!this.selectedMenuId) {
      this.menuItems = [];
      this.loading = false;
      return;
    }
    this.loading = true;
    this.orderService.getMenuItems(this.selectedMenuId).subscribe({
      next: (items) => {
        this.menuItems = items;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /** Header dropdown changed — reset navigation and load the picked menu.
   *  The cart is kept so items from multiple menus can be ordered together. */
  onMenuChange() {
    this.categoryStack = [];
    this.loadMenuItems();
  }

  /** The currently selected menu object (for the header label). */
  get selectedMenu(): Menu | null {
    return this.menus.find(m => m.id === this.selectedMenuId) ?? null;
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


  /** Items shown in the current grid view (root or the deepest open category). */
  currentItems(): MenuItem[] {
    if (this.categoryStack.length === 0) return this.menuItems;
    const top = this.categoryStack[this.categoryStack.length - 1];
    return top.children ?? [];
  }

  /** Header title: the table name at root, or the open category's name. */
  currentTitle(): SafeHtml {
    if (this.categoryStack.length === 0) {
      return this.safeHtml(this.table.orderPointName);
    }
    return this.safeHtml(this.categoryStack[this.categoryStack.length - 1].name);
  }

  /**
   * A tile is treated as a category when it has children — drilling in takes
   * precedence over its own orderable flag. The "category that's also
   * orderable" case is rare and easier to model as a separate leaf item.
   */
  isCategory(item: MenuItem): boolean {
    return !!item.children && item.children.length > 0;
  }

  tapTile(item: MenuItem): void {
    if (this.isCategory(item)) {
      this.categoryStack.push(item);
      return;
    }
    if (item.orderable) {
      this.increaseQuantity(item);
    }
  }

  decrementTile(item: MenuItem, event: globalThis.Event): void {
    event.stopPropagation();
    this.decreaseQuantity(item);
  }

  goBack(): void {
    if (this.summaryOpen) {
      this.summaryOpen = false;
      return;
    }
    this.categoryStack.pop();
  }

  /** Footer "View Summary" → swap body to the cart summary. */
  openSummary(): void {
    if (this.cart.length === 0 || !this.registrationId || this.submitting) return;
    this.summaryOpen = true;
  }

  /**
   * Menu names sometimes include HTML (e.g. {@code <font size="1">0.7L</font>}
   * to render an inline volume tag). The names come from the trusted backoffice
   * menu admin, so bypass Angular's sanitizer and render as-is. Cached so
   * change detection doesn't re-bypass on every tick.
   */
  safeHtml(value: string | null | undefined): SafeHtml {
    const text = value ?? '';
    let cached = this.safeHtmlCache.get(text);
    if (!cached) {
      cached = this.sanitizer.bypassSecurityTrustHtml(text);
      this.safeHtmlCache.set(text, cached);
    }
    return cached;
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

  /** Order-summary stepper: bump a cart line up by one. */
  incrementLine(line: CartItem): void {
    line.quantity++;
  }

  /** Order-summary stepper: drop a cart line by one, removing it at zero. */
  decrementLine(line: CartItem): void {
    line.quantity--;
    if (line.quantity <= 0) {
      this.cart = this.cart.filter(c => c.menuItemId !== line.menuItemId);
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

    // Only non-pay-later OPs show the tip + receipt picker. Treat a
    // missing payLater flag as pay-later so the picker never appears
    // unless the OP is *explicitly* marked non-pay-later (defensive
    // against an older backend that hasn't been redeployed yet).
    if (this.table.payLater !== false) {
      this.createAndDismiss(true);
      return;
    }

    // Non-pay-later OPs: open the tip picker; the waiter taps Order, then
    // confirms the receipt prompt before we create + settle + DELIVER.
    this.resetTip();
    this.pendingReceipt = false;
    this.paymentPickerOpen = true;
  }

  cancelPaymentPicker() {
    if (this.submitting) return;
    this.paymentPickerOpen = false;
    this.pendingReceipt = false;
    this.resetTip();
  }

  /** Tip step → "Get receipt from cash register?" Yes/No step.
   *  Carries the chosen method (CARD when the event is card-only). */
  askOrderReceipt(method: 'CASH' | 'CARD') {
    if (this.submitting) return;
    this.pendingMethod = method;
    this.pendingReceipt = true;
  }

  selectTipMode(mode: 'none' | 'p10' | 'p12' | 'p15' | 'customPct' | 'customAmt'): void {
    this.tipMode = mode;
    if (mode !== 'customPct') this.tipCustomPercent = null;
    if (mode !== 'customAmt') this.tipCustomAmount = null;
  }

  private resetTip(): void {
    this.tipMode = 'none';
    this.tipCustomPercent = null;
    this.tipCustomAmount = null;
  }

  /** Tip in RON resolved from the currently selected mode, clamped to >= 0. */
  computedTip(): number {
    const total = this.getTotal();
    let tip = 0;
    switch (this.tipMode) {
      case 'p10': tip = total * 0.10; break;
      case 'p12': tip = total * 0.12; break;
      case 'p15': tip = total * 0.15; break;
      case 'customPct':
        if (this.tipCustomPercent != null && !isNaN(this.tipCustomPercent)) {
          tip = total * (this.tipCustomPercent / 100);
        }
        break;
      case 'customAmt':
        if (this.tipCustomAmount != null && !isNaN(this.tipCustomAmount)) {
          tip = this.tipCustomAmount;
        }
        break;
    }
    return Math.max(0, Math.round(tip * 100) / 100);
  }

  totalWithTip(): number {
    return Math.round((this.getTotal() + this.computedTip()) * 100) / 100;
  }

  /** Receipt prompt "Yes": create the order, settle it, deliver it. */
  confirmOrderReceiptYes() {
    if (this.cart.length === 0 || !this.registrationId || this.submitting) return;

    const method = this.pendingMethod;
    const tip = this.computedTip();
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
          cashRegisterDeviceId: this.table.cashRegisterId ?? null,
          tip: tip > 0 ? tip : undefined
        }).subscribe({
          next: () => {
            this.orderService.setOrderStatus(order.id, 'DELIVERED').subscribe({
              next: () => {
                this.submitting = false;
                this.paymentPickerOpen = false;
                this.pendingReceipt = false;
                this.resetTip();
                this.modalController.dismiss({ success: true, order });
              },
              error: (err) => {
                // The order is paid; just couldn't auto-deliver. Surface
                // it as a success — the waiter can finish the move from
                // the kanban without losing the payment.
                console.error('Failed to mark order as DELIVERED:', err);
                this.submitting = false;
                this.paymentPickerOpen = false;
                this.pendingReceipt = false;
                this.resetTip();
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
        this.pendingReceipt = false;
        this.resetTip();
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