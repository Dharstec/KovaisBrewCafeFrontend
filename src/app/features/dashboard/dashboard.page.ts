import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

import { DashboardApi } from '../../core/api/dashboard.api';
import { DashboardSummary } from '../../core/models/dashboard.model';
import { AuthApi } from '../../core/api/auth.api';
import { ToastService } from '../../core/services/toast.service';
import { StockApi } from '../../core/api/stock.api';
import { StockAlerts } from '../../core/models/stock.model';

const C = [
  '#f97316','#2563eb','#16a34a','#7c3aed','#e11d48',
  '#0891b2','#d97706','#059669','#6366f1','#f59e0b',
  '#10b981','#ef4444','#ec4899','#14b8a6','#84cc16'
];

const TOOLTIP_BASE: any = {
  backgroundColor: '#1e293b',
  titleColor: '#f1f5f9',
  bodyColor: '#cbd5e1',
  titleFont: { size: 12, weight: 'bold', family: 'Inter' },
  bodyFont: { size: 11, family: 'Inter' },
  padding: 12,
  cornerRadius: 10
};

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterModule, BaseChartDirective],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit {

  private auth     = inject(AuthApi);
  private api      = inject(DashboardApi);
  private toast    = inject(ToastService);
  private stockApi = inject(StockApi);

  isAdmin      = false;
  selectedDate = new Date().toISOString().split('T')[0];
  todayStr     = new Date().toISOString().split('T')[0];
  isToday      = true;
  loadingSummary = false;
  loadingCharts  = false;

  /* ── Items Sold date range ── */
  itemStart = new Date().toISOString().split('T')[0];
  itemEnd   = new Date().toISOString().split('T')[0];
  get itemRangeLabel() {
    if (this.itemStart === this.itemEnd) return this.itemStart === this.todayStr ? 'Today' : this.itemStart;
    return `${this.itemStart} → ${this.itemEnd}`;
  }

  totalSpend    = 0;
  spendBreakdown: any[] = [];
  spendRecords:   any[] = [];

  /* ── Cashier: per-product count for the selected date ── */
  todayItems: { item_name: string; total_count: number }[] = [];
  loadingTodayItems = false;

  /* ── Cashier: stock alerts (expiry + low stock) ── */
  stockAlerts: StockAlerts | null = null;

  /* ── Range Report ── */
  rangeStart    = (() => { const d = new Date(); d.toISOString().split('T')[0]; return d.toISOString().split('T')[0]; })();
  rangeEnd      = new Date().toISOString().split('T')[0];
  rangeData: any = null;
  loadingRange  = false;

  rangeChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  rangeChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'rect', padding: 12, font: { size: 11, family: 'Inter' }, color: '#64748b', boxWidth: 10, boxHeight: 10 }
      },
      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: {
          label: (ctx: any) => `  ${ctx.dataset.label}: ₹${Number(ctx.parsed.y).toLocaleString('en-IN')}`,
          footer: (items: any[]) => {
            const s = items.find((i: any) => i.datasetIndex === 0)?.parsed.y || 0;
            const e = items.find((i: any) => i.datasetIndex === 1)?.parsed.y || 0;
            const net = s - e;
            return net !== 0 ? [`  ─────────────`, `  Net: ₹${Number(net).toLocaleString('en-IN')}`] : [];
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { font: { size: 10, family: 'Inter' }, color: '#94a3b8', maxRotation: 45, maxTicksLimit: 20 }
      },
      y: {
        beginAtZero: true, border: { display: false },
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 10 }, color: '#94a3b8',
          callback: (v: any) => v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K' : '₹' + v
        }
      }
    }
  };

  data: DashboardSummary = {
    today_sales: 0, today_bills: 0, cash_total: 0, upi_total: 0,
    pending_bills: 0, products: 0, categories: 0, employees: 0,
    attendance: { present: 0, absent: 0 },
    stock: { total_items: 0, low_stock: 0, out_of_stock: 0 }
  };

  /* ═══ CHART 1 — Hourly Stacked Bar ═══ */
  hourChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  hourChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true, pointStyle: 'rect',
          padding: 12, font: { size: 11, family: 'Inter' },
          color: '#64748b', boxWidth: 10, boxHeight: 10
        }
      },
      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: {
          title: (items: any[]) => items[0]?.label ? `🕐 ${items[0].label}` : '',
          label:  (ctx: any)    => ctx.parsed.y > 0 ? `  ${ctx.dataset.label}: ${ctx.parsed.y}` : null,
          footer: (items: any[]) => {
            const t = items.reduce((s: number, i: any) => s + (i.parsed.y || 0), 0);
            return t > 0 ? [`  ─────────────`, `  Total: ${t} units`] : [];
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true, grid: { display: false }, border: { display: false },
        ticks: { font: { size: 10, family: 'Inter' }, color: '#94a3b8', maxRotation: 45, maxTicksLimit: 16 }
      },
      y: {
        stacked: true, beginAtZero: true, border: { display: false },
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 10 }, color: '#94a3b8' }
      }
    }
  };

  /* ═══ CHART 2 — Items Sold Horizontal Bar ═══ */
  itemChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  itemChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: {
          label: (ctx: any) => `  Units sold: ${ctx.parsed.x}`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true, border: { display: false },
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 10 }, color: '#94a3b8' }
      },
      y: {
        grid: { display: false }, border: { display: false },
        ticks: { font: { size: 12, family: 'Inter' }, color: '#374151' }
      }
    }
  };

  /* ═══ CHART 4 — Sales vs Spend ═══ */
  spendChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  spendChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: {
          label: (ctx: any) => `  ₹${Number(ctx.parsed.x).toLocaleString('en-IN')}`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true, border: { display: false },
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 10 }, color: '#94a3b8',
          callback: (v: any) => v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K' : '₹' + v
        }
      },
      y: {
        grid: { display: false }, border: { display: false },
        ticks: { font: { size: 12, family: 'Inter' }, color: '#374151' }
      }
    }
  };

  /* ═══ CHART 3 — Payment Bar ═══ */
  payChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  payChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: {
          label: (ctx: any) => `  Revenue: ₹${Number(ctx.parsed.y).toLocaleString('en-IN')}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { font: { size: 12, family: 'Inter', weight: 'bold' }, color: '#374151' }
      },
      y: {
        beginAtZero: true, border: { display: false },
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 10 }, color: '#94a3b8',
          callback: (v: any) => v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K' : '₹' + v
        }
      }
    }
  };

  /* ── Init ── */
  ngOnInit() {
    this.isAdmin = this.auth.isAdmin();
    this.loadAll();
    if (this.isAdmin) this.loadRange();
  }

  onDateChange() { this.isToday = this.selectedDate === this.todayStr; this.loadAll(); }
  goToday()      { this.selectedDate = this.todayStr; this.isToday = true; this.loadAll(); }
  refresh()      { this.loadAll(); }

  applyItemRange() {
    if (!this.itemStart || !this.itemEnd) return;
    this.api.getItemSalesChart(undefined, this.itemStart, this.itemEnd).subscribe({
      next:  res => this.buildItemChart(res),
      error: ()  => {}
    });
  }

  loadAll() {
    const d = this.selectedDate || undefined;
    this.loadSummary(d);
    if (this.isAdmin) this.loadCharts(d);
    if (this.isAdmin) this.loadSpend(d);
    if (!this.isAdmin) { this.loadTodayItems(d); this.loadStockAlerts(); }
  }

  private loadStockAlerts() {
    this.stockApi.getAlerts().subscribe({
      next: res => { this.stockAlerts = res; },
      error: () => {}
    });
  }

  fmtDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private loadTodayItems(date?: string) {
    this.loadingTodayItems = true;
    this.api.getItemSalesChart(date, date, date).subscribe({
      next: (res: any[]) => {
        this.todayItems = (res || [])
          .map(r => ({ item_name: r.item_name, total_count: Number(r.total_count) || 0 }))
          .sort((a, b) => b.total_count - a.total_count);
        this.loadingTodayItems = false;
      },
      error: () => { this.todayItems = []; this.loadingTodayItems = false; }
    });
  }

  get todayItemsTotal(): number {
    return this.todayItems.reduce((s, i) => s + i.total_count, 0);
  }

  private loadSummary(date?: string) {
    this.loadingSummary = true;
    this.api.getSummary(date).subscribe({
      next:  res => { this.data = res; this.loadingSummary = false; },
      error: ()  => { this.loadingSummary = false; }
    });
  }

  private loadCharts(date?: string) {
    this.loadingCharts = true;

    this.api.getHourlyItemSales(date).subscribe({
      next:  res => this.buildHourlyChart(res),
      error: ()  => {}
    });

    this.api.getItemSalesChart(date, this.itemStart, this.itemEnd).subscribe({
      next:  res => this.buildItemChart(res),
      error: ()  => {}
    });

    this.api.getPaymentBreakdown(date).subscribe({
      next:  res => { this.buildPaymentChart(res); this.loadingCharts = false; },
      error: ()  => {
        // Fallback: build from summary totals
        if (this.data.cash_total || this.data.upi_total) {
          const fallback: any[] = [];
          if (this.data.cash_total) fallback.push({ payment_mode: 'CASH', total_amount: this.data.cash_total, bill_count: '' });
          if (this.data.upi_total)  fallback.push({ payment_mode: 'UPI',  total_amount: this.data.upi_total,  bill_count: '' });
          this.buildPaymentChart(fallback);
        }
        this.loadingCharts = false;
      }
    });
  }

  loadRange() {
    this.loadingRange = true;
    this.api.getRangeSummary(this.rangeStart, this.rangeEnd).subscribe({
      next: res => {
        this.rangeData = res;
        this.buildRangeChart(res);
        this.loadingRange = false;
      },
      error: () => { this.loadingRange = false; }
    });
  }

  buildRangeChart(res: any) {
    const salesMap  = new Map<string, number>();
    const spendMap  = new Map<string, number>();
    (res.daily_sales  || []).forEach((d: any) => salesMap.set(d.day.slice(0,10),  Number(d.sales)));
    (res.daily_spend  || []).forEach((d: any) => spendMap.set(d.day.slice(0,10),  Number(d.spend)));

    // build full date axis between start & end
    const labels: string[] = [];
    const cur = new Date(res.start);
    const fin = new Date(res.end);
    while (cur <= fin) {
      labels.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const fmt = (d: string) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    this.rangeChartData = {
      labels: labels.map(fmt),
      datasets: [
        {
          label: 'Sales',
          data:  labels.map(l => salesMap.get(l) || 0),
          backgroundColor: '#16a34acc',
          borderColor:     '#16a34a',
          borderWidth: 0, borderRadius: 4, type: 'bar' as any
        },
        {
          label: 'Expenses',
          data:  labels.map(l => spendMap.get(l) || 0),
          backgroundColor: '#ef4444cc',
          borderColor:     '#ef4444',
          borderWidth: 0, borderRadius: 4, type: 'bar' as any
        }
      ]
    };
  }

  private loadSpend(date?: string) {
    this.api.getDailySpend(date).subscribe({
      next: res => {
        this.totalSpend     = res.total_spend;
        this.spendBreakdown = res.breakdown || [];
        this.spendRecords   = res.records   || [];
        this.buildSpendChart(res.breakdown);
      },
      error: () => {}
    });
  }

  /* ── Chart Builders ── */
  buildHourlyChart(data: any[]) {
    if (!data?.length) { this.hourChartData = { labels: [], datasets: [] }; return; }

    const labels = [...new Set(data.map((d: any) => d.time_range as string))];

    // Top 12 items by total volume
    const totals = new Map<string, number>();
    data.forEach((d: any) => totals.set(d.item_name, (totals.get(d.item_name) || 0) + Number(d.total_count)));
    const topItems = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(e => e[0]);

    this.hourChartData = {
      labels,
      datasets: topItems.map((item, i) => ({
        label: item,
        data:  labels.map(l => {
          const row = data.find((d: any) => d.item_name === item && d.time_range === l);
          return Number(row?.total_count || 0);
        }),
        backgroundColor: C[i % C.length] + 'dd',
        borderColor:     C[i % C.length],
        borderWidth: 0,
        borderRadius: 2
      }))
    };
  }

  buildItemChart(data: any[]) {
    if (!data?.length) { this.itemChartData = { labels: [], datasets: [] }; return; }
    const top = data.slice(0, 15);
    this.itemChartData = {
      labels: top.map((d: any) => d.item_name),
      datasets: [{
        label: 'Units Sold',
        data:  top.map((d: any) => Number(d.total_count) || 0),
        backgroundColor: top.map((_: any, i: number) => C[i % C.length] + 'cc'),
        borderColor:     top.map((_: any, i: number) => C[i % C.length]),
        borderWidth: 0,
        borderRadius: 6
      }]
    };
  }

  buildPaymentChart(data: any[]) {
    if (!data?.length) { this.payChartData = { labels: [], datasets: [] }; return; }
    const clr: Record<string, string> = { CASH: '#16a34a', UPI: '#7c3aed', CARD: '#2563eb', OTHER: '#f97316' };
    this.payChartData = {
      labels: data.map((d: any) => d.bill_count ? `${d.payment_mode} (${d.bill_count})` : d.payment_mode),
      datasets: [{
        label: 'Revenue',
        data:  data.map((d: any) => Number(d.total_amount) || 0),
        backgroundColor: data.map((d: any) => (clr[d.payment_mode] || '#64748b') + 'cc'),
        borderColor:     data.map((d: any) => clr[d.payment_mode] || '#64748b'),
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false
      }]
    };
  }

  buildSpendChart(breakdown: any[]) {
    if (!breakdown?.length) {
      // Show simple Sales vs Spend if no breakdown
      const sales = this.data.today_sales;
      const spend = this.totalSpend;
      if (!sales && !spend) { this.spendChartData = { labels: [], datasets: [] }; return; }
      this.spendChartData = {
        labels: ['Total Sales', 'Total Expenses'],
        datasets: [{
          label: 'Amount',
          data: [sales, spend],
          backgroundColor: ['#16a34acc', '#ef4444cc'],
          borderColor: ['#16a34a', '#ef4444'],
          borderWidth: 0, borderRadius: 6
        }]
      };
      return;
    }
    // Show breakdown + sales header
    const labels = ['Total Sales', ...breakdown.map((d: any) => d.reason || 'Other')];
    const values = [this.data.today_sales, ...breakdown.map((d: any) => Number(d.total))];
    const colors = ['#16a34a', '#ef4444', '#f97316', '#7c3aed', '#2563eb', '#d97706', '#0891b2', '#ec4899'];
    this.spendChartData = {
      labels,
      datasets: [{
        label: 'Amount',
        data: values,
        backgroundColor: labels.map((_: any, i: number) => (i === 0 ? '#16a34acc' : colors[(i % (colors.length - 1)) + 1] + 'cc')),
        borderColor:     labels.map((_: any, i: number) => (i === 0 ? '#16a34a'   : colors[(i % (colors.length - 1)) + 1])),
        borderWidth: 0, borderRadius: 6
      }]
    };
  }

  /* ── Formatters ── */
  fmtCurrency(val: number): string {
    if (!val || val === 0) return '₹0';
    if (val >= 10000000) return '₹' + (val / 10000000).toFixed(1) + ' Cr';
    if (val >= 100000)   return '₹' + (val / 100000).toFixed(2) + ' L';
    if (val >= 1000)     return '₹' + (val / 1000).toFixed(1) + 'K';
    return '₹' + Math.round(val);
  }

  fmtNum(val: number): string {
    return val >= 1000 ? (val / 1000).toFixed(1) + 'K' : String(val);
  }

  get displayDate(): string {
    if (!this.selectedDate) return '';
    return new Date(this.selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  get cashPct():       number { const t = (this.data.cash_total || 0) + (this.data.upi_total || 0); return t ? Math.round((this.data.cash_total / t) * 100) : 0; }
  get upiPct():        number { return 100 - this.cashPct; }
  get attendancePct(): number { const t = (this.data.attendance.present || 0) + (this.data.attendance.absent || 0); return t ? Math.round((this.data.attendance.present / t) * 100) : 0; }

  get hasRangeChart() { return (this.rangeChartData.datasets?.[0]?.data?.length || 0) > 0; }

  get rangeDays(): number {
    if (!this.rangeStart || !this.rangeEnd) return 0;
    const diff = new Date(this.rangeEnd).getTime() - new Date(this.rangeStart).getTime();
    return Math.round(diff / 86400000) + 1;
  }

  get netProfit():    number { return (this.data.today_sales || 0) - (this.totalSpend || 0); }
  get spendPct():     number { const s = this.data.today_sales; return s ? Math.round((this.totalSpend / s) * 100) : 0; }

  get hasHourData()  { return (this.hourChartData.datasets?.length || 0) > 0; }
  get hasItemData()  { return (this.itemChartData.datasets?.[0]?.data?.length || 0) > 0; }
  get hasPayData()   { return (this.payChartData.datasets?.[0]?.data?.length || 0) > 0; }
  get hasSpendData() { return (this.spendChartData.datasets?.[0]?.data?.length || 0) > 0; }
}
