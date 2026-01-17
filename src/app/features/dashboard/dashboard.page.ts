import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { DashboardApi } from '../../core/api/dashboard.api';
import { DashboardSummary } from '../../core/models/dashboard.model';
import { AuthApi } from '../../core/api/auth.api';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, BaseChartDirective],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit {

  auth = inject(AuthApi);
  api = inject(DashboardApi);

  isAdmin = this.auth.isAdmin();

  /* =======================
     KPI DATA
     ======================= */
  data: DashboardSummary = {
    today_sales: 0,
    today_bills: 0,
    pending_bills: 0,
    products: 0,
    categories: 0,
    employees: 0,
    attendance: { present: 0, absent: 0 },
    stock: { total_items: 0, low_stock: 0, out_of_stock: 0 }
  };

  /* =======================
     CHART CONFIG
     ======================= */
  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  hourChartData!: ChartConfiguration['data'];
  itemChartData!: ChartConfiguration['data'];

  ngOnInit() {
    this.api.getSummary().subscribe(res => {
      this.data = res;
    });

    // API 1 → Hour based
    this.api.getHourlyItemSales().subscribe(res => {
      this.buildHourlyChart(res);
    });

    // API 2 → Item based
    this.api.getItemSalesChart().subscribe(res => {
      this.buildItemChart(res);
    });
  }

  /* =======================
     HOUR BASED CHART
     10–11 → Coffee → 10
     ======================= */
  buildHourlyChart(data: any[]) {

    // Convert string counts → number
    const normalized = data.map(d => ({
      ...d,
      total_count: Number(d.total_count)
    }));

    const labels = [...new Set(normalized.map(d => d.time_range))];

    const items = [...new Set(normalized.map(d => d.item_name))];

    this.hourChartData = {
      labels,
      datasets: items.map(item => ({
        label: item,
        data: labels.map(label =>
          normalized.find(
            d => d.item_name === item && d.time_range === label
          )?.total_count || 0
        ),
        tension: 0.4
      }))
    };
  }


  /* =======================
     ITEM BASED TOTAL CHART
     Coffee → 24
     ======================= */
  buildItemChart(data: any[]) {
    this.itemChartData = {
      labels: data.map(d => d.item_name),
      datasets: [{
        label: 'Total Sold',
        data: data.map(d => d.total_count)
      }]
    };
  }
}
