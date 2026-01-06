import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CouponApi {

  constructor(private http: HttpClient) {}

  create(body: any) {
    return this.http.post(`${environment.apiUrl}/coupons`, body);
  }

  getAll() { return this.http.get<any[]>(`${environment.apiUrl}/coupons`); }
  update(id: number, b: any) { return this.http.put(`${environment.apiUrl}/coupons/${id}`, b); }
  delete(id: number) { return this.http.delete(`${environment.apiUrl}/coupons/${id}`); }
}
