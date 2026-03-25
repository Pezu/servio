import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleSwitchComponent),
      multi: true
    }
  ],
  template: `
    <label class="toggle-switch" [class.disabled]="disabled">
      <input
        type="checkbox"
        [checked]="checked"
        [disabled]="disabled"
        (change)="onToggle($event)">
      <span class="toggle-slider"></span>
      <span class="toggle-label" *ngIf="label">{{ label }}</span>
    </label>
  `,
  styles: [`
    .toggle-switch {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    .toggle-switch.disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .toggle-switch input {
      display: none;
    }
    .toggle-slider {
      position: relative;
      width: 44px;
      height: 24px;
      background: #cbd5e1;
      border-radius: 24px;
      transition: all 0.2s ease;
    }
    .toggle-slider::before {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    }
    input:checked + .toggle-slider {
      background: #10b981;
    }
    input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }
    .toggle-label {
      font-size: 14px;
      color: #475569;
      user-select: none;
    }
  `]
})
export class ToggleSwitchComponent implements ControlValueAccessor {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() label = '';
  @Output() change = new EventEmitter<boolean>();

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  onToggle(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.checked = input.checked;
    this.onChange(this.checked);
    this.onTouched();
    this.change.emit(this.checked);
  }

  // ControlValueAccessor implementation
  writeValue(value: boolean): void {
    this.checked = value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
