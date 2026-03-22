import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DashboardSummary } from '../models/dashboard.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardApi {

  private http = inject(HttpClient);

  getSummary(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.http.get<DashboardSummary>(
      `${environment.apiUrl}/dashboard/summary`, { params }
    );
  }

  getHourlyItemSales(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.http.get<any[]>(
      `${environment.apiUrl}/dashboard/hourly_sales`, { params }
    );
  }

  getItemSalesChart(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.http.get<any[]>(
      `${environment.apiUrl}/dashboard/sales_chart`, { params }
    );
  }

  getPaymentBreakdown(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.http.get<any[]>(
      `${environment.apiUrl}/dashboard/payment_breakdown`, { params }
    );
  }

  getRangeSummary(start: string, end: string) {
    return this.http.get<any>(
      `${environment.apiUrl}/dashboard/range_summary`, { params: { start, end } }
    );
  }

  getDailySpend(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.http.get<{ total_spend: number; breakdown: any[]; records: any[] }>(
      `${environment.apiUrl}/dashboard/daily_spend`, { params }
    );
  }
}
