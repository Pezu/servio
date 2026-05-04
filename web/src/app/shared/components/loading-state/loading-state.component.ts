import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [],
  template: `
    <div class="loading-state" [class.inline]="inline">
      <div class="spinner" [style.width.px]="size" [style.height.px]="size"></div>
      @if (message) {
        <p>{{ message }}</p>
      }
    </div>
    `,
  styles: [`
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }
    .loading-state.inline {
      padding: 20px;
      flex-direction: row;
      gap: 12px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    p {
      margin: 16px 0 0;
      font-size: 14px;
      color: #64748b;
    }
    .inline p {
      margin: 0;
    }
  `]
})
export class LoadingStateComponent {
  @Input() message = 'Loading...';
  @Input() size = 40;
  @Input() inline = false;
}
