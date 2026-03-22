import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthApi } from '../core/api/auth.api';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent {

  auth = inject(AuthApi);
  router = inject(Router);

  menuOpen = false;
  menu = this.auth.getMenu();
  isAdmin = this.auth.isAdmin();
  deferredPrompt: any;
  showInstallBtn = false;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
  ngOnInit() {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBtn = true;
    });
  }
  installApp() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(() => {
      this.deferredPrompt = null;
      this.showInstallBtn = false;
    });
  }
  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
