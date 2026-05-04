import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="placeholder">
        <div class="placeholder-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <span class="placeholder-text">In progress...</span>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 400px;
    }
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      color: #94a3b8;
    }
    .placeholder-icon {
      width: 64px;
      height: 64px;
    }
    .placeholder-icon svg {
      width: 100%;
      height: 100%;
    }
    .placeholder-text {
      font-size: 18px;
      font-weight: 500;
    }
  `]
})
export class ReportsComponent {}