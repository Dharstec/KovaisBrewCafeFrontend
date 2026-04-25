import { Component, inject, OnInit, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthApi } from '../core/api/auth.api';
import { StockApi } from '../core/api/stock.api';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent implements OnInit {

  auth     = inject(AuthApi);
  router   = inject(Router);
  stockApi = inject(StockApi);

  menuOpen      = false;
  hrOpen        = false;   // desktop HR dropdown
  hrMobileOpen  = false;   // mobile drawer HR section expand
  profileOpen   = false;   // desktop profile dropdown

  menu    = this.auth.getMenu();
  isAdmin = this.auth.isAdmin();

  alertCount = 0;

  shops: { id: number; name: string }[] = [];
  currentShopId = this.auth.getCurrentShopId();
  shopMenuOpen = false;

  deferredPrompt: any;
  showInstallBtn = false;

  get userName():    string { return this.auth.getUser()?.user_name || 'User'; }
  get userInitial(): string { return this.userName.charAt(0).toUpperCase(); }
  get userRole():    string { return this.isAdmin ? 'Administrator' : 'Staff'; }

  /* Close HR dropdown when clicking outside */
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.hr-dropdown-wrap'))  this.hrOpen      = false;
    if (!target.closest('.profile-wrap'))       this.profileOpen = false;
    if (!target.closest('.shop-switcher-wrap')) this.shopMenuOpen = false;
  }

  toggleShopMenu() { this.shopMenuOpen = !this.shopMenuOpen; }

  switchShop(shopId: number) {
    if (shopId === this.currentShopId) { this.shopMenuOpen = false; return; }
    this.auth.setCurrentShopId(shopId);
    this.currentShopId = shopId;
    this.shopMenuOpen = false;
    // Hard reload so all loaded data refetches under the new shop
    window.location.reload();
  }

  get currentShopName(): string {
    return this.shops.find(s => s.id === this.currentShopId)?.name || `Shop ${this.currentShopId}`;
  }

  toggleMenu()    { this.menuOpen    = !this.menuOpen; }
  toggleHr()      { this.hrOpen      = !this.hrOpen; }
  toggleHrMobile(){ this.hrMobileOpen= !this.hrMobileOpen; }
  toggleProfile() { this.profileOpen = !this.profileOpen; }

  ngOnInit() {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBtn = true;
    });

    this.stockApi.getAlerts().subscribe({
      next: res => { this.alertCount = (res.expiring_count || 0) + (res.low_stock_count || 0); },
      error: () => {}
    });

    if (this.isAdmin) {
      this.auth.getShops().subscribe({
        next: res => { this.shops = res?.data || []; },
        error: () => {}
      });
    }
  }

  installApp() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(() => {
      this.deferredPrompt  = null;
      this.showInstallBtn  = false;
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  closeAll() {
    this.menuOpen     = false;
    this.hrOpen       = false;
    this.hrMobileOpen = false;
  }
}
