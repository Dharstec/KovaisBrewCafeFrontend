import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getUsers() {
    return this.http.get<any>(`${this.base}/users`);
  }

  createUser(payload: {
    user_name: string; email: string; password: string;
    role_id: number; shop_id?: number | null;
  }) {
    return this.http.post<any>(`${this.base}/create`, payload);
  }

  updateUser(id: number, payload: {
    user_name?: string; role_id?: number; shop_id?: number | null; password?: string;
  }) {
    return this.http.put<any>(`${this.base}/users/${id}`, payload);
  }

  deleteUser(id: number) {
    return this.http.delete<any>(`${this.base}/users/${id}`);
  }

  getRoles() {
    return this.http.get<any>(`${this.base}/roles`);
  }

  createRole(role_type: string) {
    return this.http.post<any>(`${this.base}/roles`, { role_type });
  }
}
