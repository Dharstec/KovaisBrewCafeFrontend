import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StockApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getStock() {
    return this.http.get<any[]>(`${this.base}/stock`);
  }

  getDropdown() {
    return this.http.get<any[]>(`${this.base}/stock_dropdown`);
  }

  adjust(payload: { product_id: number; change_qty: number; reason: string; note?: string }) {
    return this.http.post<any>(`${this.base}/stock/adjust`, payload);
  }

  addEntry(payload: any) {
    return this.http.post<any>(`${this.base}/stock/add`, payload);
  }

  addBulk(payload: any) {
    return this.http.post<any>(`${this.base}/stock/add-bulk`, payload);
  }

  getEntries(params?: { stock_item_id?: number; page?: number; limit?: number }) {
    let p = new HttpParams();
    if (params?.stock_item_id) p = p.set('stock_item_id', params.stock_item_id);
    if (params?.page)          p = p.set('page', params.page);
    if (params?.limit)         p = p.set('limit', params.limit);
    return this.http.get<any>(`${this.base}/stock/entries`, { params: p });
  }

  updateEntry(id: number, payload: { expiry_date?: string; batch_no?: string; supplier?: string; notes?: string }) {
    return this.http.patch<any>(`${this.base}/stock/entries/${id}`, payload);
  }

  getPriceHistory(id: number) {
    return this.http.get<any[]>(`${this.base}/stock/price-history/${id}`);
  }

  getExpiring(days = 7) {
    return this.http.get<any[]>(`${this.base}/stock/expiring`, {
      params: new HttpParams().set('days', days)
    });
  }

  getAlerts() {
    return this.http.get<{
      expiring: any[];
      low_stock: any[];
      expiring_count: number;
      low_stock_count: number;
    }>(`${this.base}/stock/alerts`);
  }

  getLogs(params?: { stock_item_id?: number; action?: string; limit?: number; offset?: number }) {
    let p = new HttpParams();
    if (params?.stock_item_id) p = p.set('stock_item_id', params.stock_item_id);
    if (params?.action)        p = p.set('action', params.action);
    if (params?.limit)         p = p.set('limit', params.limit);
    if (params?.offset)        p = p.set('offset', params.offset);
    return this.http.get<any[]>(`${this.base}/stock/logs`, { params: p });
  }

  /* ── STOCK ITEMS MANAGEMENT ── */
  getStockItemsList(params?: { search?: string; page?: number; limit?: number }) {
    let p = new HttpParams();
    if (params?.search) p = p.set('search', params.search);
    if (params?.page)   p = p.set('page', String(params.page));
    if (params?.limit)  p = p.set('limit', String(params.limit));
    return this.http.get<any>(`${this.base}/stock-items`, { params: p });
  }

  createStockItem(payload: any) {
    return this.http.post<any>(`${this.base}/stock-items`, payload);
  }

  updateStockItem(id: number, payload: any) {
    return this.http.put<any>(`${this.base}/stock-items/${id}`, payload);
  }

  toggleStockItem(id: number) {
    return this.http.patch<any>(`${this.base}/stock-items/${id}/toggle`, {});
  }

  deleteStockItem(id: number) {
    return this.http.delete<any>(`${this.base}/stock-items/${id}`);
  }

  getCategories() {
    return this.http.get<any>(`${this.base}/category`);
  }
}
