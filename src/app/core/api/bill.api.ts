import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BillApi {

  private http = inject(HttpClient);

  create(payload: { customer_name: string; items: any[]; local_id?: string }) {
    return this.http.post<any>(`${environment.apiUrl}/bills`, payload);
  }

  update(id: number, payload: { customer_name: string; items: any[] }) {
    return this.http.put(`${environment.apiUrl}/bills/${id}`, payload);
  }

  syncOffline(payload: {
    customer_name: string; items: any[]; payment_mode: string;
    grand_total: number; discount_amount?: number; local_id: string; platform?: string | null;
  }) {
    return this.http.post<any>(`${environment.apiUrl}/bills/sync`, payload);
  }

  pending() {
    return this.http.get<any[]>(`${environment.apiUrl}/pending`);
  }

  get(id: number) {
    return this.http.get<any[]>(`${environment.apiUrl}/bills/${id}`);
  }

  complete(id: number, body: any) {
    return this.http.post(`${environment.apiUrl}/bill/complete/${id}`, body);
  }

  applyCoupon(id: number, body: any) {
    return this.http.post(`${environment.apiUrl}/apply/${id}`, body);
  }

  cancel(id: number) {
    return this.http.post(`${environment.apiUrl}/bill/cancel/${id}`, {});
  }

  completed(startDate?: string, endDate?: string, page = 1, limit = 20, platform?: string) {
    return this.http.get<any>(
      `${environment.apiUrl}/completed`,
      {
        params: {
          ...(startDate && { start_date: startDate }),
          ...(endDate   && { end_date:   endDate   }),
          ...(platform  && { platform }),
          page,
          limit
        }
      }
    );
  }
}
