import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warn' | 'info';
  title: string;
  message?: string;
  leaving?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {

  private nextId = 0;
  private _toasts = new BehaviorSubject<Toast[]>([]);
  toasts$ = this._toasts.asObservable();

  success(title: string, message?: string) {
    this._add({ type: 'success', title, message });
  }

  error(title: string, message?: string) {
    this._add({ type: 'error', title, message });
  }

  warn(title: string, message?: string) {
    this._add({ type: 'warn', title, message });
  }

  info(title: string, message?: string) {
    this._add({ type: 'info', title, message });
  }

  dismiss(id: number) {
    // animate out first
    const list = this._toasts.value.map(t =>
      t.id === id ? { ...t, leaving: true } : t
    );
    this._toasts.next(list);
    setTimeout(() => {
      this._toasts.next(this._toasts.value.filter(t => t.id !== id));
    }, 220);
  }

  private _add(toast: Omit<Toast, 'id'>) {
    const id = ++this.nextId;
    this._toasts.next([...this._toasts.value, { ...toast, id }]);
    setTimeout(() => this.dismiss(id), 4000);
  }
}
