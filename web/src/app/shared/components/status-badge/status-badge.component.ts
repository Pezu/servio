import { Component, Input } from '@angular/core';

import { STATUS_COLORS } from '../../constants';

type StatusType = keyof typeof STATUS_COLORS;

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [],
  template: `
    <span
      class="status-badge"
      [style.background]="backgroundColor"
      [style.color]="textColor">
      @if (showDot) {
        <span class="status-dot" [style.background]="textColor"></span>
      }
      {{ displayText }}
    </span>
    `,
  styles: [`
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      text-transform: capitalize;
      white-space: nowrap;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: string = '';
  @Input() text?: string;
  @Input() showDot = false;

  get normalizedStatus(): StatusType {
    const upper = this.status.toUpperCase().replace(/-/g, '_');
    return (upper in STATUS_COLORS ? upper : 'PENDING') as StatusType;
  }

  get backgroundColor(): string {
    return STATUS_COLORS[this.normalizedStatus]?.bg || STATUS_COLORS.PENDING.bg;
  }

  get textColor(): string {
    return STATUS_COLORS[this.normalizedStatus]?.color || STATUS_COLORS.PENDING.color;
  }

  get displayText(): string {
    if (this.text) return this.text;
    return this.status.toLowerCase().replace(/_/g, ' ');
  }
}
