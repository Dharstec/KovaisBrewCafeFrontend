import { Component, inject } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopbarComponent } from './layout/topbar.component';
import { AuthApi } from './core/api/auth.api';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TopbarComponent],
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
