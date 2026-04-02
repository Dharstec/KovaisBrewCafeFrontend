import { Component, inject } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopbarComponent } from './layout/topbar.component';
import { ToastComponent } from './shared/toast/toast.component';
import { PwaInstallBannerComponent } from './shared/pwa-install-banner/pwa-install-banner.component';
import { AuthApi } from './core/api/auth.api';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TopbarComponent, ToastComponent, PwaInstallBannerComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {

  router = inject(Router);
  auth = inject(AuthApi);

  showHeader = false;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe(event => {
        this.showHeader =
          this.auth.isLoggedIn() &&
          !event.urlAfterRedirects.includes('/login');
      });
  }
}
