import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { receiptOutline } from 'ionicons/icons';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon],
  template: `
    <div class="placeholder">
      <ion-icon name="receipt-outline"></ion-icon>
      <h2>Orders</h2>
      <p>In progress...</p>
    </div>
  `,
  styles: [`
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--ion-color-medium);
      text-align: center;
      padding: 24px;
    }

    .placeholder ion-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .placeholder h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: var(--ion-color-dark);
    }

    .placeholder p {
      margin: 0;
      font-size: 14px;
    }
  `]
})
export class OrdersPage {
  constructor() {
    addIcons({ receiptOutline });
  }
}