import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  IonContent,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  cashOutline,
  walletOutline,
  closeOutline,
  storefrontOutline,
  documentTextOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { OrderService, Order, EventOrderPoint } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { WebSocketService } from '../../../services/websocket.service';

interface TableGroup {
  orderPointId: string;
  orderPointName: string;
  orders: Order[];
  total: number;
}

/**
 * One selectable row in the Partial-pay overview: unpaid units of the same
 * product (name + unit price) aggregated across the order point's orders. The
 * cashier dials {@code selectedQty} down from {@code maxQty}; on Pay the chosen
 * quantity is allocated back across {@code sources} (the underlying order-item
 * ids), which the backend splits as needed.
 */
interface PartialLine {
  key: string;
  name: string;
  unitPrice: number;
  maxQty: number;
  selectedQty: number;
  sources: { orderItemId: string; quantity: number }[];
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent
  ],
  template: `
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="state-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (myOrderPointIds.length === 0) {
        <div class="state-container">
          <ion-icon name="wallet-outline"></ion-icon>
          <h2>No order points assigned</h2>
          <p>You are not assigned to any pay-later order points for this event.</p>
        </div>
      } @else if (tableGroups.length === 0) {
        <div class="state-container">
          <ion-icon name="wallet-outline"></ion-icon>
          <p>No orders awaiting payment.</p>
        </div>
      } @else {
        <div class="tables">
          @for (table of tableGroups; track table.orderPointId) {
            <div class="table-card">
              <div class="table-head">
                <span class="table-name">{{ table.orderPointName }}</span>
                <div class="table-head-right">
                  <span class="table-total">{{ formatPrice(table.total) }}</span>
                  <button class="info-table-btn" (click)="openInfo(table, $event)">
                    Info
                  </button>
                  <div class="pay-menu-wrapper">
                    <button class="pay-table-btn" (click)="togglePayMenu(table.orderPointId, $event)">
                      Pay
                    </button>
                    @if (openPayMenuFor === table.orderPointId) {
                      <div class="pay-menu" (click)="$event.stopPropagation()">
                        <button class="pay-menu-item" (click)="payAll(table)">All</button>
                        <button class="pay-menu-item" (click)="payPartial(table)">Partial</button>
                      </div>
                    }
                  </div>
                </div>
              </div>

              @for (order of table.orders; track order.id) {
                <div class="order-block">
                  <div class="order-head">
                    <div class="order-meta">
                      <span class="order-no">#{{ order.orderNo }}</span>
                      @if (order.nickname) {
                        <span class="nickname">{{ order.nickname }}</span>
                      }
                    </div>
                    <div class="order-head-right">
                      <span class="order-total">{{ formatPrice(orderTotal(order)) }}</span>
                    </div>
                  </div>

                  <div class="items">
                    @for (item of activeItems(order); track item.id) {
                      <div class="item">
                        <span class="qty">{{ item.quantity }}x</span>
                        <span class="name" [innerHTML]="safeHtml(item.name)"></span>
                        <span class="price">{{ formatPrice(item.price * item.quantity) }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </ion-content>

    @if (showPaymentModal) {
      <div class="modal-overlay" (click)="closePaymentModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>Select Payment Method</h3>
            <button class="modal-close" (click)="closePaymentModal()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>

          <div class="modal-summary">
            <span>{{ pendingOrders.length }} {{ pendingOrders.length === 1 ? 'order' : 'orders' }}</span>
            <span class="modal-total">{{ formatPrice(pendingTotal) }}</span>
          </div>

          @if (!pendingOpIsProtocol && !pendingReceiptMethod) {
            <div class="section-label">Tip</div>
            <div class="tip-row">
              <button class="tip-chip" [class.active]="tipMode === 'none'" [disabled]="busy" (click)="selectTipMode('none')">None</button>
              <button class="tip-chip" [class.active]="tipMode === 'p10'" [disabled]="busy" (click)="selectTipMode('p10')">10%</button>
              <button class="tip-chip" [class.active]="tipMode === 'p12'" [disabled]="busy" (click)="selectTipMode('p12')">12%</button>
              <button class="tip-chip" [class.active]="tipMode === 'p15'" [disabled]="busy" (click)="selectTipMode('p15')">15%</button>
              <button class="tip-chip" [class.active]="tipMode === 'customPct'" [disabled]="busy" (click)="selectTipMode('customPct')">Custom %</button>
              <button class="tip-chip" [class.active]="tipMode === 'customAmt'" [disabled]="busy" (click)="selectTipMode('customAmt')">Custom RON</button>
            </div>
            @if (tipMode === 'customPct') {
              <div class="tip-input-row">
                <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="Percent"
                  [(ngModel)]="tipCustomPercent" [disabled]="busy" />
                <span class="tip-input-suffix">%</span>
              </div>
            }
            @if (tipMode === 'customAmt') {
              <div class="tip-input-row">
                <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="Amount"
                  [(ngModel)]="tipCustomAmount" [disabled]="busy" />
                <span class="tip-input-suffix">RON</span>
              </div>
            }
            <div class="tip-summary">
              <span class="tip-summary-label">Tip</span>
              <span class="tip-summary-value">{{ formatPrice(computedTip()) }}</span>
            </div>
            <div class="tip-summary total">
              <span class="tip-summary-label">Total to pay</span>
              <span class="tip-summary-value">{{ formatPrice(totalWithTip()) }}</span>
            </div>
          }

          @if (pendingReceiptMethod) {
            <div class="receipt-confirm">
              <div class="receipt-confirm-question">Get receipt from cash register?</div>
              <div class="receipt-confirm-row">
                <button class="receipt-btn no" [disabled]="busy" (click)="confirmReceiptNo()">No</button>
                <button class="receipt-btn yes" [disabled]="busy" (click)="confirmReceiptYes()">Yes</button>
              </div>
            </div>
          } @else {
            <div class="section-label">Payment method</div>
            <div class="method-row">
              @if (pendingOpIsProtocol) {
                <button
                  class="method-btn protocol"
                  [disabled]="busy"
                  (click)="confirmPayment('PROTOCOL')">
                  <ion-icon name="document-text-outline"></ion-icon> Protocol
                </button>
              } @else {
                <button
                  class="method-btn cash"
                  [disabled]="busy"
                  (click)="askReceipt('CASH')">
                  <ion-icon name="cash-outline"></ion-icon> Cash
                </button>
                <button
                  class="method-btn card"
                  [disabled]="busy"
                  (click)="askReceipt('CARD')">
                  <ion-icon name="card-outline"></ion-icon> Card
                </button>
              }
            </div>
          }
        </div>
      </div>
    }

    @if (showPartialModal && partialTable) {
      <div class="modal-overlay" (click)="closePartialModal()">
        <div class="partial-sheet" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ partialTable.orderPointName }} — Partial</h3>
            <button class="modal-close" (click)="closePartialModal()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>

          <div class="partial-hint">Choose how many of each item to settle now.</div>

          <div class="partial-lines">
            @for (line of partialLines; track line.key) {
              <div class="partial-line" [class.zeroed]="line.selectedQty === 0">
                <div class="partial-info">
                  <span class="partial-name" [innerHTML]="safeHtml(line.name)"></span>
                  <span class="partial-unit">{{ formatPrice(line.unitPrice) }} · {{ line.maxQty }} ordered</span>
                </div>
                <div class="stepper">
                  <button class="step-btn" [disabled]="busy || line.selectedQty === 0" (click)="decPartial(line)">−</button>
                  <span class="step-qty">{{ line.selectedQty }}</span>
                  <button class="step-btn" [disabled]="busy || line.selectedQty === line.maxQty" (click)="incPartial(line)">+</button>
                </div>
                <span class="partial-line-total">{{ formatPrice(line.unitPrice * line.selectedQty) }}</span>
              </div>
            }
          </div>

          <div class="partial-foot">
            <div class="partial-total-row">
              <span>{{ partialSelectedUnits() }} {{ partialSelectedUnits() === 1 ? 'item' : 'items' }} selected</span>
              <span class="partial-total">{{ formatPrice(partialSelectedTotal()) }}</span>
            </div>
            <button class="partial-pay-btn" [disabled]="busy || partialSelectedUnits() === 0" (click)="proceedPartialPayment()">
              Pay
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    ion-content {
      --background: #ffffff;
    }

    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #64748b;
    }

    .state-container ion-icon {
      font-size: 56px;
      margin-bottom: 12px;
      color: #94a3b8;
    }

    .state-container h2 {
      font-size: 17px;
      color: #1e293b;
      margin: 0 0 6px;
    }

    .state-container p {
      margin: 0;
      font-size: 14px;
    }

    .tables {
      padding: 12px;
    }

    .table-card {
      border: 1px solid #e2e8f0;
      margin-bottom: 16px;
      background: #ffffff;
    }

    .table-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .table-head-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .table-name {
      font-weight: 700;
      font-size: 16px;
      color: #1e293b;
    }

    .table-total {
      font-weight: 700;
      font-size: 15px;
      color: #1e293b;
    }

    .pay-table-btn {
      padding: 6px 14px;
      border: 1px solid var(--ion-color-primary);
      background: transparent;
      color: var(--ion-color-primary);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border-radius: 0;
    }

    .info-table-btn {
      padding: 6px 14px;
      border: 1px solid #cbd5e1;
      background: transparent;
      color: #475569;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border-radius: 0;
    }

    .pay-menu-wrapper {
      position: relative;
      display: inline-block;
    }

    .pay-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      z-index: 50;
      min-width: 120px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
      display: flex;
      flex-direction: column;
    }

    .pay-menu-item {
      padding: 10px 14px;
      border: none;
      border-bottom: 1px solid #f1f5f9;
      background: transparent;
      color: #1e293b;
      font-size: 13px;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }

    .pay-menu-item:last-child {
      border-bottom: none;
    }

    .pay-menu-item:hover {
      background: #f8fafc;
    }

    .order-block {
      border-bottom: 1px solid #f1f5f9;
      padding: 10px 12px;
    }

    .order-block:last-child {
      border-bottom: none;
    }

    .order-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .order-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .order-head-right {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .order-no {
      font-weight: 600;
      color: #1e293b;
      font-size: 14px;
    }

    .nickname {
      font-size: 12px;
      color: #64748b;
      font-style: italic;
    }

    .order-total {
      font-weight: 600;
      color: #475569;
      font-size: 14px;
    }

    .items {
      padding-bottom: 4px;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 2px 0;
      font-size: 13px;
    }

    .item .qty {
      min-width: 28px;
      font-weight: 600;
      color: #475569;
    }

    .item .name {
      flex: 1;
      color: #1e293b;
    }

    .item .name font[size="1"] {
      font-size: 11px;
      font-weight: 500;
      opacity: 0.7;
      margin-left: 4px;
    }

    .item .price {
      color: #475569;
      font-variant-numeric: tabular-nums;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      display: flex;
      justify-content: center;
      align-items: flex-end;
      z-index: 9999;
      padding: 0;
    }

    .modal {
      background: #ffffff;
      width: 100%;
      max-width: 560px;
      border: 1px solid #e2e8f0;
      border-radius: 0;
      max-height: 90vh;
      overflow-y: auto;
    }

    /* Partial-pay selection sheet */
    .partial-sheet {
      background: #ffffff;
      width: 100%;
      max-width: 560px;
      border: 1px solid #e2e8f0;
      border-radius: 0;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
    }

    .partial-hint {
      padding: 10px 16px;
      font-size: 13px;
      color: #64748b;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .partial-lines {
      flex: 1;
      overflow-y: auto;
    }

    .partial-line {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
    }

    .partial-line.zeroed {
      opacity: 0.5;
    }

    .partial-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .partial-name {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }

    .partial-unit {
      font-size: 12px;
      color: #64748b;
    }

    .stepper {
      display: flex;
      align-items: center;
      gap: 0;
      border: 1px solid #cbd5e1;
    }

    .step-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: #f8fafc;
      color: #1e293b;
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
    }

    .step-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .step-qty {
      min-width: 36px;
      text-align: center;
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
    }

    .partial-line-total {
      min-width: 72px;
      text-align: right;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      font-variant-numeric: tabular-nums;
    }

    .partial-foot {
      border-top: 1px solid #e2e8f0;
      padding: 12px 16px 16px;
      background: #ffffff;
    }

    .partial-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      color: #1e293b;
      padding-bottom: 12px;
    }

    .partial-total {
      font-weight: 700;
      font-size: 16px;
    }

    .partial-pay-btn {
      width: 100%;
      padding: 14px;
      border: 1px solid var(--ion-color-primary);
      background: var(--ion-color-primary);
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      border-radius: 0;
    }

    .partial-pay-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-head h3 {
      margin: 0;
      font-size: 16px;
      color: #1e293b;
      font-weight: 700;
    }

    .modal-close {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
    }

    .modal-close ion-icon {
      font-size: 22px;
    }

    .modal-summary {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
      color: #1e293b;
    }

    .modal-total {
      font-weight: 700;
    }

    .section-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      padding: 12px 16px 6px;
    }

    .tip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px;
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
      padding: 10px 16px 0;
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
      padding: 8px 16px 0;
      color: #475569;
      font-size: 13px;
    }

    .tip-summary.total {
      padding-top: 6px;
      padding-bottom: 12px;
      color: #1e293b;
      font-size: 15px;
      font-weight: 700;
    }

    .method-row {
      display: flex;
      gap: 8px;
      padding: 0 16px 16px;
    }

    .receipt-confirm {
      padding: 16px 16px 20px;
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

    .method-btn {
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

    .method-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .method-btn ion-icon {
      font-size: 18px;
    }

    .method-btn.cash {
      color: #16a34a;
      border-color: #16a34a;
    }

    .method-btn.card {
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }

    .method-btn.protocol {
      color: #b45309;
      border-color: #f59e0b;
    }
  `]
})
export class PaymentsPage implements OnInit, OnDestroy {
  eventId = '';
  currentUser = '';
  loading = true;

  myOrderPointIds: string[] = [];
  needsPaymentOrders: Order[] = [];
  tableGroups: TableGroup[] = [];

  // OP id → assigned cash register id (from Edit Event → Order Points).
  // The bulk-paid endpoint forwards this to the cash-register listener;
  // backend gracefully falls back to the event's first CR when null.
  private cashRegisterByOrderPointId = new Map<string, string>();
  // OP id → protocol flag (Edit Event → Order Points → Protocol column).
  // True means the OP is settled via internal protocol — the modal then
  // exposes Protocol as the only payment method.
  private protocolByOrderPointId = new Map<string, boolean>();
  selectedCashRegisterDeviceId: string | null = null;

  /** OrderPoint id whose Pay dropdown (All / Partial) is currently open. */
  openPayMenuFor: string | null = null;

  // Partial-pay selection overview (Pay → Partial).
  showPartialModal = false;
  partialTable: TableGroup | null = null;
  partialLines: PartialLine[] = [];
  /** True while the payment modal is settling a partial selection rather than
   *  whole orders — routes confirmPayment to the partial endpoint. */
  partialMode = false;
  /** Allocated {orderItemId, quantity} selection carried into the payment modal. */
  private partialItems: { orderItemId: string; quantity: number }[] = [];

  showPaymentModal = false;
  pendingOrders: Order[] = [];
  pendingTotal = 0;
  /** Whether the OP being settled is marked as protocol-only. */
  pendingOpIsProtocol = false;
  busy = false;

  /**
   * Set once the cashier picks Cash/Card so the modal shows a
   * "Get receipt from cash register?" Yes/No confirm. Yes runs the
   * payment; No closes the modal without charging anything.
   */
  pendingReceiptMethod: 'CASH' | 'CARD' | null = null;

  // Tip selector state (only relevant when pendingOpIsProtocol === false).
  tipMode: 'none' | 'p10' | 'p12' | 'p15' | 'customPct' | 'customAmt' = 'none';
  tipCustomPercent: number | null = null;
  tipCustomAmount: number | null = null;

  private subs: Subscription[] = [];
  private readonly safeHtmlCache = new Map<string, SafeHtml>();

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private authService: AuthService,
    private ws: WebSocketService,
    private sanitizer: DomSanitizer
  ) {
    addIcons({ cardOutline, cashOutline, walletOutline, closeOutline, storefrontOutline, documentTextOutline });
  }

  /**
   * Item names sometimes contain HTML the menu admin wrote (e.g.
   * {@code <font size="1">0.7L</font>}). Trust it and render with innerHTML;
   * cache the SafeHtml so change detection doesn't re-bypass each tick.
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

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    this.currentUser = this.authService.getUserInfo()?.username || '';
    this.load();
    this.ws.connect();
    this.subs.push(
      this.ws.subscribeToEventPayments(this.eventId).subscribe(() => this.loadNeedsPayment()),
      this.ws.subscribeToEventOrders(this.eventId).subscribe(() => this.loadNeedsPayment())
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  refresh(ev: RefresherCustomEvent): void {
    this.loadNeedsPayment(() => ev.target.complete());
  }

  load(): void {
    this.loading = true;
    this.orderService.getEventOrderPoints(this.eventId).subscribe({
      next: (eops: EventOrderPoint[]) => {
        this.myOrderPointIds = eops
          .filter(e => (e.userLogins || []).includes(this.currentUser))
          .map(e => e.orderPointId);
        this.cashRegisterByOrderPointId.clear();
        this.protocolByOrderPointId.clear();
        for (const eop of eops) {
          if (eop.cashRegisterId) {
            this.cashRegisterByOrderPointId.set(eop.orderPointId, eop.cashRegisterId);
          }
          this.protocolByOrderPointId.set(eop.orderPointId, !!eop.protocol);
        }
        this.loadNeedsPayment();
      },
      error: () => {
        this.myOrderPointIds = [];
        this.loading = false;
      }
    });
  }

  loadNeedsPayment(done?: () => void): void {
    if (this.myOrderPointIds.length === 0) {
      this.needsPaymentOrders = [];
      this.tableGroups = [];
      this.loading = false;
      done?.();
      return;
    }
    this.orderService.getOrdersNeedingPayment(this.eventId).subscribe({
      next: (orders) => {
        this.needsPaymentOrders = orders.filter(o => this.myOrderPointIds.includes(o.orderPointId));
        this.regroup();
        this.loading = false;
        done?.();
      },
      error: () => {
        this.loading = false;
        done?.();
      }
    });
  }

  private regroup(): void {
    const map = new Map<string, TableGroup>();
    for (const order of this.needsPaymentOrders) {
      let g = map.get(order.orderPointId);
      if (!g) {
        g = { orderPointId: order.orderPointId, orderPointName: order.orderPointName, orders: [], total: 0 };
        map.set(order.orderPointId, g);
      }
      g.orders.push(order);
      g.total += this.orderTotal(order);
    }
    this.tableGroups = Array.from(map.values()).sort((a, b) =>
      a.orderPointName.localeCompare(b.orderPointName)
    );
  }

  activeItems(order: Order) {
    return order.items.filter(i => i.status !== 'CANCELLED' && !i.paid);
  }

  orderTotal(order: Order): number {
    return this.activeItems(order).reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  formatPrice(value: number): string {
    if (value === Math.floor(value)) {
      return `${value.toFixed(0)} RON`;
    }
    return `${value.toFixed(2)} RON`;
  }

  /** Close the Pay dropdown on any click outside it (the toggle stops propagation). */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.openPayMenuFor = null;
  }

  /** Toggle the Pay dropdown for a table. Stops propagation so the document
   *  listener above doesn't immediately close what we just opened. */
  togglePayMenu(orderPointId: string, ev: Event): void {
    ev.stopPropagation();
    this.openPayMenuFor = this.openPayMenuFor === orderPointId ? null : orderPointId;
  }

  /** "All" — settle every outstanding order on the table (current behaviour). */
  payAll(table: TableGroup): void {
    this.openPayMenuFor = null;
    this.openPaymentModal(table.orders, table.orderPointId);
  }

  /** "Partial" — open the overview where the cashier dials quantities down,
   *  then continues into the normal payment-method / tip flow. */
  payPartial(table: TableGroup): void {
    this.openPayMenuFor = null;
    if (this.busy) return;
    this.partialTable = table;
    this.partialLines = this.buildPartialLines(table);
    this.showPartialModal = true;
  }

  /** Aggregate the order point's unpaid, non-cancelled items by name + price. */
  private buildPartialLines(table: TableGroup): PartialLine[] {
    const byKey = new Map<string, PartialLine>();
    for (const order of table.orders) {
      for (const item of this.activeItems(order)) {
        const key = `${item.name}|${item.price}`;
        let line = byKey.get(key);
        if (!line) {
          line = {
            key,
            name: item.name,
            unitPrice: item.price,
            maxQty: 0,
            selectedQty: 0,
            sources: []
          };
          byKey.set(key, line);
        }
        line.maxQty += item.quantity;
        line.selectedQty += item.quantity; // default: pay everything
        line.sources.push({ orderItemId: item.id, quantity: item.quantity });
      }
    }
    return Array.from(byKey.values());
  }

  incPartial(line: PartialLine): void {
    if (line.selectedQty < line.maxQty) line.selectedQty++;
  }

  decPartial(line: PartialLine): void {
    if (line.selectedQty > 0) line.selectedQty--;
  }

  /** Running total of the partial selection (before tip). */
  partialSelectedTotal(): number {
    return this.partialLines.reduce((sum, l) => sum + l.unitPrice * l.selectedQty, 0);
  }

  partialSelectedUnits(): number {
    return this.partialLines.reduce((sum, l) => sum + l.selectedQty, 0);
  }

  closePartialModal(): void {
    this.showPartialModal = false;
    this.partialTable = null;
    this.partialLines = [];
  }

  /**
   * Allocate each line's selected quantity back across its underlying order
   * items, then hand off to the shared payment modal in partial mode.
   */
  proceedPartialPayment(): void {
    if (this.busy || !this.partialTable) return;
    const items: { orderItemId: string; quantity: number }[] = [];
    for (const line of this.partialLines) {
      let remaining = line.selectedQty;
      for (const source of line.sources) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, source.quantity);
        if (take > 0) {
          items.push({ orderItemId: source.orderItemId, quantity: take });
          remaining -= take;
        }
      }
    }
    if (items.length === 0) return;

    const table = this.partialTable;
    const total = this.partialSelectedTotal();
    this.showPartialModal = false;
    this.openPaymentModal(table.orders, table.orderPointId, { items, total });
  }

  /** "Info" — show details for the table's order point. Implementation pending. */
  openInfo(table: TableGroup, ev: Event): void {
    ev.stopPropagation();
    this.openPayMenuFor = null;
    // TODO: implement info view for the order point.
  }

  openPaymentModal(
    orders: Order[],
    orderPointId?: string,
    partial?: { items: { orderItemId: string; quantity: number }[]; total: number }
  ): void {
    if (this.busy) return;
    this.pendingOrders = orders;
    if (partial) {
      this.partialMode = true;
      this.partialItems = partial.items;
      this.pendingTotal = partial.total;
    } else {
      this.partialMode = false;
      this.partialItems = [];
      this.pendingTotal = orders.reduce((sum, o) => sum + this.orderTotal(o), 0);
    }
    // Resolve the cash register from the OP's assignment (Edit Event →
    // Order Points). Backend gracefully falls back to the event's first
    // CR when null, so we don't need to load the CR list ourselves.
    const opId = orderPointId ?? orders[0]?.orderPointId;
    this.selectedCashRegisterDeviceId = opId ? this.cashRegisterByOrderPointId.get(opId) ?? null : null;
    this.pendingOpIsProtocol = opId ? this.protocolByOrderPointId.get(opId) === true : false;
    this.resetTip();
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.pendingOrders = [];
    this.pendingTotal = 0;
    this.pendingOpIsProtocol = false;
    this.pendingReceiptMethod = null;
    this.partialMode = false;
    this.partialItems = [];
    this.resetTip();
  }

  /** Cashier picked Cash/Card — show the receipt-confirm prompt. */
  askReceipt(method: 'CASH' | 'CARD'): void {
    if (this.busy) return;
    this.pendingReceiptMethod = method;
  }

  confirmReceiptYes(): void {
    if (!this.pendingReceiptMethod) return;
    const method = this.pendingReceiptMethod;
    this.pendingReceiptMethod = null;
    this.confirmPayment(method);
  }

  confirmReceiptNo(): void {
    this.pendingReceiptMethod = null;
    this.closePaymentModal();
  }

  private resetTip(): void {
    this.tipMode = 'none';
    this.tipCustomPercent = null;
    this.tipCustomAmount = null;
  }

  selectTipMode(mode: 'none' | 'p10' | 'p12' | 'p15' | 'customPct' | 'customAmt'): void {
    this.tipMode = mode;
    if (mode !== 'customPct') this.tipCustomPercent = null;
    if (mode !== 'customAmt') this.tipCustomAmount = null;
  }

  /** Tip in RON resolved from the currently selected mode, clamped to >= 0. */
  computedTip(): number {
    const total = this.pendingTotal;
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
    return Math.round((this.pendingTotal + this.computedTip()) * 100) / 100;
  }

  confirmPayment(method: 'CASH' | 'CARD' | 'PROTOCOL'): void {
    if (this.busy) return;
    const orders = this.pendingOrders;
    const deviceId = this.selectedCashRegisterDeviceId;
    if (orders.length === 0) {
      this.closePaymentModal();
      return;
    }

    this.busy = true;

    // Only Cash/Card flows can carry a tip — PROTOCOL always settles flat.
    const tip = method === 'PROTOCOL' ? 0 : this.computedTip();

    const onDone = () => {
      this.busy = false;
      this.closePaymentModal();
      this.loadNeedsPayment();
    };
    const onError = (err: unknown) => {
      console.error('[Payments] mark paid failed:', err);
      this.busy = false;
      this.closePaymentModal();
      this.loadNeedsPayment();
    };

    // Partial mode settles only the selected item quantities (backend splits
    // items as needed); full mode marks the whole orders paid. Both fire the
    // cash-register print via PaymentCompletedEvent (PROTOCOL skips the print).
    if (this.partialMode) {
      this.orderService.partialMarkPaid({
        items: this.partialItems,
        paymentMethod: method,
        paidBy: this.currentUser,
        cashRegisterDeviceId: deviceId,
        tip: tip > 0 ? tip : undefined
      }).subscribe({ next: onDone, error: onError });
    } else {
      this.orderService.bulkMarkPaid({
        orderIds: orders.map(o => o.id),
        paymentMethod: method,
        paidBy: this.currentUser,
        cashRegisterDeviceId: deviceId,
        tip: tip > 0 ? tip : undefined
      }).subscribe({ next: onDone, error: onError });
    }
  }
}
