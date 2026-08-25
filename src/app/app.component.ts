import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopbarComponent } from './layout/topbar.component';
import { ToastComponent } from './shared/toast/toast.component';
import { AuthApi } from './core/api/auth.api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TopbarComponent, ToastComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {

  router = inject(Router);
  auth = inject(AuthApi);

  get showHeader(): boolean {
    return this.auth.isLoggedIn() && !this.router.url.includes('/login');
  }
}
