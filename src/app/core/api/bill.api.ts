import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface StockShortfallIngredient {
  stock_item_id: number;
  name: string;
  required: number;
  available: number;
  unit_label: string;
}

export interface StockShortfallEntry {
  product_id: number;
  product_name: string;
  type: 'direct' | 'recipe';
  required: number;
  available?: number;
  unit_label?: string;
  ingredients?: StockShortfallIngredient[];
}

export interface StockCheckResult {
  ok: boolean;
  shortfall: StockShortfallEntry[];
}

@Injectable({ providedIn: 'root' })
export class BillApi {

  private http = inject(HttpClient);

  create(payload: { customer_name: string; items: any[]; local_id?: string; platform?: string | null; bill_date?: string | null }) {
    return this.http.post<any>(`${environment.apiUrl}/bills`, payload);
  }

  update(id: number, payload: { customer_name: string; items: any[] }) {
    return this.http.put(`${environment.apiUrl}/bills/${id}`, payload);
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

  checkStock(items: { productId: number; qty: number; name?: string }[]) {
    return this.http.post<StockCheckResult>(`${environment.apiUrl}/bills/check-stock`, { items });
  }

  editCompleted(id: number, payload: { customer_name: string; items: any[] }) {
    return this.http.put<any>(`${environment.apiUrl}/bills/completed/${id}`, payload);
  }

  deleteCompleted(id: number) {
    return this.http.delete<any>(`${environment.apiUrl}/bills/completed/${id}`);
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
