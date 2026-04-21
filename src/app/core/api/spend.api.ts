import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class  SpendService {

  private http = inject(HttpClient);
  private API = `${environment.apiUrl}/shop_spend`;

  /* =============================
     GET ALL SPEND (LIST PAGE)
     ============================= */
  getAll(
    searchTerm = '',
    page = 1,
    pageSize = 10,
    sortColumn = 'date',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    startDate = '',
    endDate = ''
  ) {
    return this.http.get<any>(this.API, {
      params: {
        searchTerm,
        page,
        pageSize,
        sortColumn,
        sortOrder,
        ...(startDate ? { startDate } : {}),
        ...(endDate   ? { endDate   } : {})
      }
    });
  }

  /* =============================
     UNIQUE REASONS (for dropdown)
     ============================= */
  getUniqueReasons() {
    return this.http.get<string[]>(`${this.API}/reasons`);
  }

  /* =============================
     CREATE SPEND
     ============================= */
  create(body: any) {
    return this.http.post<any>(this.API, body);
  }

  /* =============================
     UPDATE SPEND
     ============================= */
  update(id: number, body: any) {
    return this.http.put<any>(`${this.API}/${id}`, body);
  }

  /* =============================
     DELETE SPEND
     ============================= */
  delete(id: number) {
    return this.http.delete<any>(`${this.API}/${id}`);
  }

  /* =============================
     SPLIT PAYMENTS
     ============================= */
  getPayments(spentId: number) {
    return this.http.get<any[]>(`${this.API}/${spentId}/payments`);
  }

  addPayment(spentId: number, body: { payment_date: string; amount: number; payment_mode: string; note?: string }) {
    return this.http.post<any>(`${this.API}/${spentId}/payments`, body);
  }

  deletePayment(spentId: number, paymentId: number) {
    return this.http.delete<any>(`${this.API}/${spentId}/payments/${paymentId}`);
  }
}
