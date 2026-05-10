import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthApi {

  private platformId = inject(PLATFORM_ID);

  constructor(private http: HttpClient) { }

  /* ---------- LOGIN API ---------- */
  login(payload: any) {
    return this.http.post<any>(`${environment.apiUrl}/login`, payload);
  }

  getShops() {
    return this.http.get<any>(`${environment.apiUrl}/shops`);
  }

  /* ---------- SESSION ---------- */
  saveSession(data: any) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user_data));
      // Cashier: shop_id is fixed; admin (shop_id null): default to 1, can switch later
      const shopId = data.user_data?.shop_id ?? 1;
      localStorage.setItem('shop_id', String(shopId));
    }
  }

  getCurrentShopId(): number {
    if (!isPlatformBrowser(this.platformId)) return 1;
    const user = this.getUser();
    if (user?.shop_id) return Number(user.shop_id);
    const stored = localStorage.getItem('shop_id');
    return stored ? Number(stored) : 1;
  }

  setCurrentShopId(shopId: number) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('shop_id', String(shopId));
    }
  }

  isLoggedIn(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return !!localStorage.getItem('token');
    // return !!localStorage.getItem('token')

  }

  getUser() {
    if (!isPlatformBrowser(this.platformId)) return null;
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  getRole(): string {
    return this.getUser()?.role_type || '';
  }

  isAdmin(): boolean {
    return this.getRole() === 'Admin';
  }

  isManager(): boolean {
    return this.getRole() === 'Manager';
  }

  isManagerOrAdmin(): boolean {
    return this.isAdmin() || this.isManager();
  }

  getMenu() {
    return this.getUser()?.menu?.side_menu || {};
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.clear();
    }
  }
}
