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
    RouterLinkActive   // 🔥 REQUIRED
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

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
