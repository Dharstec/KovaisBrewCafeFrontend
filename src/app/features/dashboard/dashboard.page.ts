import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { DashboardApi } from '../../core/api/dashboard.api';
import { DashboardSummary } from '../../core/models/dashboard.model';
import { AuthApi } from '../../core/api/auth.api';
import { ToastService } from '../../core/services/toast.service';

/* ── Colour palette shared across charts ── */
const CHART_COLORS = [
  '#ff7a18','#2563eb','#16a34a','#7c3aed',
  '#e11d48','#0891b2','#d97706','#059669',
  '#6366f1','#f59e0b','#10b981','#ef4444'
];

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterModule, BaseChartDirective],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit {

  private auth  = inject(AuthApi);
  private api   = inject(DashboardApi);
  private toast = inject(ToastService);

  /* ── Role ── */
  isAdmin = false;

  /* ── Date picker (defaults to today) ── */
  selectedDate = new Date().toISOString().split('T')[0];
  todayStr     = new Date().toISOString().split('T')[0];
  isToday      = true;

  /* ── KPI data ── */
  data: DashboardSummary = {
    today_sales: 0, today_bills: 0, cash_total: 0, upi_total: 0,
    pending_bills: 0, products: 0, categories: 0, employees: 0,
    attendance: { present: 0, absent: 0 },
    stock: { total_items: 0, low_stock: 0, out_of_stock: 0 }
  };

  /* ── Loading flags ── */
  loadingSummary = false;
  loadingCharts  = false;

  /* ──────────────────────────────────────
     CHART 1: Hourly sales  (Line)
     ────────────────────────────────────── */
  hourChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  hourChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} units` } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: '#f3f4f6' }
      }
    }
  };

  /* ──────────────────────────────────────
     CHART 2: Items sold  (Horizontal Bar)
     ────────────────────────────────────── */
  itemChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  itemChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` Sold: ${ctx.parsed.x} units` } }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: '#f3f4f6' }
      },
      y: { grid: { display: false }, ticks: { font: { size: 12 } } }
    }
  };

  /* ──────────────────────────────────────
     CHART 3: Payment breakdown  (Doughnut)
     ────────────────────────────────────── */
  payChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  payChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const val  = (ctx.raw as number) || 0;
            const total = ((ctx.dataset.data as number[]) || []).reduce((a, b) => a + b, 0);
            const pct  = total ? ((val / total) * 100).toFixed(1) : '0';
            return ` ₹${val.toFixed(2)}  (${pct}%)`;
          }
        }
      }
    }
  };

  /* ── Init ── */
  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    this.loadAll();
  }

  /* ── Date picker change ── */
  onDateChange() {
    const today = new Date().toISOString().split('T')[0];
    this.isToday = this.selectedDate === today;
    this.loadAll();
  }

  goToday() {
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.isToday = true;
    this.loadAll();
  }

  /* ── Refresh ── */
  refresh() { this.loadAll(); }

  /* ── Load everything ── */
  loadAll() {
    const d = this.selectedDate || undefined;
    this.loadSummary(d);
    if (this.isAdmin) {
      this.loadCharts(d);
    }
  }

  private loadSummary(date?: string) {
    this.loadingSummary = true;
    this.api.getSummary(date).subscribe({
      next: res => { this.data = res; this.loadingSummary = false; },
      error: () => { this.toast.error('Load failed', 'Dashboard summary error.'); this.loadingSummary = false; }
    });
  }

  private loadCharts(date?: string) {
    this.loadingCharts = true;

    this.api.getHourlyItemSales(date).subscribe({
      next: res => this.buildHourlyChart(res),
      error: () => this.toast.error('Chart error', 'Hourly sales chart failed.')
    });

    this.api.getItemSalesChart(date).subscribe({
      next: res => this.buildItemChart(res),
      error: () => this.toast.error('Chart error', 'Item sales chart failed.')
    });

    this.api.getPaymentBreakdown(date).subscribe({
      next: res => { this.buildPaymentChart(res); this.loadingCharts = false; },
      error: () => { this.toast.error('Chart error', 'Payment chart failed.'); this.loadingCharts = false; }
    });
  }

  /* ── Chart builders ── */
  buildHourlyChart(data: any[]) {
    if (!data?.length) { this.hourChartData = { labels: [], datasets: [] }; return; }

    const labels  = [...new Set(data.map(d => d.time_range))];
    const items   = [...new Set(data.map(d => d.item_name))];

    this.hourChartData = {
      labels,
      datasets: items.map((item, i) => ({
        label: item as string,
        data: labels.map(l =>
          data.find(d => d.item_name === item && d.time_range === l)?.total_count || 0
        ),
        borderColor:     CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '22',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }))
    };
  }

  buildItemChart(data: any[]) {
    if (!data?.length) { this.itemChartData = { labels: [], datasets: [] }; return; }

    this.itemChartData = {
      labels: data.map(d => d.item_name),
      datasets: [{
        label: 'Units Sold',
        data: data.map(d => Number(d.total_count) || 0),
        backgroundColor: data.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'cc'),
        borderColor:     data.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1.5,
        borderRadius: 6
      }]
    };
  }

  buildPaymentChart(data: any[]) {
    if (!data?.length) { this.payChartData = { labels: [], datasets: [] }; return; }

    this.payChartData = {
      labels: data.map(d => `${d.payment_mode} (${d.bill_count} bills)`),
      datasets: [{
        data: data.map(d => Number(d.total_amount) || 0),
        backgroundColor: ['#16a34a', '#7c3aed', '#2563eb', '#f59e0b'],
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 6
      }]
    };
  }

  /* ── Helpers ── */
  get displayDate(): string {
    if (!this.selectedDate) return '';
    return new Date(this.selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  get hasHourData()  { return (this.hourChartData.datasets?.length || 0) > 0; }
  get hasItemData()  { return (this.itemChartData.datasets?.[0]?.data?.length || 0) > 0; }
  get hasPayData()   { return (this.payChartData.datasets?.[0]?.data?.length || 0) > 0; }
}
