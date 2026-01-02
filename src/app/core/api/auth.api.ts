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

  /* ---------- SESSION ---------- */
  saveSession(data: any) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user_data));
    }
  }

  isLoggedIn(): boolean {
    // if (!isPlatformBrowser(this.platformId)) return false;
    // return !!localStorage.getItem('token');
    return !!localStorage.getItem('token')

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

  getMenu() {
    return this.getUser()?.menu?.side_menu || {};
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.clear();
    }
  }
}
