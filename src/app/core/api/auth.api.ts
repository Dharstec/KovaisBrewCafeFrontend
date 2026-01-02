import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthApi {

  private platformId = inject(PLATFORM_ID);
  private loggedIn$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {
    // ✅ initialize auth state once
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      this.loggedIn$.next(!!token);
    }
  }

  /* ---------- LOGIN API ---------- */
  login(payload: any) {
    return this.http.post<any>(`${environment.apiUrl}/login`, payload);
  }

  /* ---------- SESSION ---------- */
  saveSession(data: any) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user_data));
      this.loggedIn$.next(true); // 🔥 IMPORTANT
    }
  }

  /* ---------- AUTH STATE ---------- */

  // Used by Guards
  isLoggedIn$() {
    return this.loggedIn$.asObservable();
  }

  // Used by components
  isLoggedIn(): boolean {
    return this.loggedIn$.value;
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
      this.loggedIn$.next(false); // 🔥 IMPORTANT
    }
  }
}
