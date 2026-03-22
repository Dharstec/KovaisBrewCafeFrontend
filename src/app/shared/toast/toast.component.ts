import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../core/services/toast.service';

@Component({
  standalone: true,
  selector: 'app-toast',
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        class="toast"
        [class]="'toast toast-' + t.type + (t.leaving ? ' leaving' : '')"
        *ngFor="let t of svc.toasts$ | async; trackBy: trackById">

        <span class="toast-icon">{{ icons[t.type] }}</span>

        <div class="toast-body">
          <div class="toast-title">{{ t.title }}</div>
          <div class="toast-msg" *ngIf="t.message">{{ t.message }}</div>
        </div>

        <button class="toast-close" (click)="svc.dismiss(t.id)">✕</button>
      </div>
    </div>
  `
})
export class ToastComponent {
  svc = inject(ToastService);

  icons: Record<string, string> = {
    success: '✅',
    error:   '❌',
    warn:    '⚠️',
    info:    'ℹ️'
  };

  trackById(_: number, t: Toast) { return t.id; }
}
