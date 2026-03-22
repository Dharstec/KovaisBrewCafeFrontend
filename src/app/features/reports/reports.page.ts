import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillApi } from '../../core/api/bill.api';
import { ToastService } from '../../core/services/toast.service';

export interface ReportColumn {
  key: string;
  label: string;
  visible: boolean;
}

@Component({
  standalone: true,
  selector: 'app-reports-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss']
})
export class ReportsPage implements OnInit {

  private api   = inject(BillApi);
  private toast = inject(ToastService);

  /* ── Date Range ── */
  startDate = '';
  endDate   = '';

  /* ── Column Config ── */
  columns: ReportColumn[] = [
    { key: 'id',            label: 'Bill #',       visible: true  },
    { key: 'created_at',    label: 'Date & Time',  visible: true  },
    { key: 'customer_name', label: 'Customer',     visible: true  },
    { key: 'items',         label: 'Items',        visible: true  },
    { key: 'subtotal',      label: 'Subtotal (₹)', visible: true  },
    { key: 'coupon_code',   label: 'Coupon Code',  visible: false },
    { key: 'discount',      label: 'Discount (₹)', visible: false },
    { key: 'grand_total',   label: 'Grand Total (₹)', visible: true },
    { key: 'payment_mode',  label: 'Payment Mode', visible: true  },
  ];

  showColSelector = false;

  /* ── Data ── */
  bills: any[] = [];
  loading = false;

  /* ── Pagination ── */
  page       = 1;
  limit      = 50;
  totalPages = 1;
  pages: number[] = [];

  /* ── Totals ── */
  cashTotal  = 0;
  upiTotal   = 0;
  grandTotal = 0;

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];
    this.startDate = today;
    this.endDate   = today;
    this.load();
  }

  get visibleColumns() {
    return this.columns.filter(c => c.visible);
  }

  get allSelected() {
    return this.columns.every(c => c.visible);
  }

  toggleAll(checked: boolean) {
    this.columns.forEach(c => c.visible = checked);
  }

  /* ── Load ── */
  load() {
    if (!this.startDate || !this.endDate) {
      this.toast.warn('Select both dates', 'Please pick a start and end date.');
      return;
    }
    this.loading = true;
    this.api.completed(this.startDate, this.endDate, this.page, this.limit)
      .subscribe({
        next: res => {
          this.bills      = res.data || [];
          this.totalPages = res.totalPages || 1;
          this.pages      = Array.from({ length: this.totalPages }, (_, i) => i + 1);
          this.cashTotal  = Number(res.summary?.cash_total  || 0);
          this.upiTotal   = Number(res.summary?.upi_total   || 0);
          this.grandTotal = Number(res.summary?.grand_total || 0);
          this.loading    = false;
        },
        error: () => {
          this.toast.error('Load failed', 'Could not fetch report data.');
          this.loading = false;
        }
      });
  }

  applyFilter() {
    this.page = 1;
    this.load();
  }

  /* ── Pagination ── */
  goTo(p: number) { this.page = p; this.load(); }
  prev()          { if (this.page > 1) { this.page--; this.load(); } }
  next()          { if (this.page < this.totalPages) { this.page++; this.load(); } }

  /* ── Helpers ── */
  itemsSummary(bill: any): string {
    if (!bill.items?.length) return '—';
    return bill.items
      .map((i: any) => `${i.name} ×${i.qty}`)
      .join(', ');
  }

  subtotal(bill: any): number {
    if (!bill.items?.length) return Number(bill.grand_total) || 0;
    return bill.items.reduce((s: number, i: any) =>
      s + (Number(i.price) * Number(i.qty)), 0);
  }

  cellValue(bill: any, key: string): string {
    switch (key) {
      case 'id':            return '#' + bill.id;
      case 'created_at':    return this.formatDate(bill.created_at);
      case 'customer_name': return bill.customer_name || '—';
      case 'items':         return this.itemsSummary(bill);
      case 'subtotal':      return '₹ ' + this.subtotal(bill).toFixed(2);
      case 'coupon_code':   return bill.coupon_code || '—';
      case 'discount':      return bill.discount_amount
                              ? '₹ ' + Number(bill.discount_amount).toFixed(2)
                              : '—';
      case 'grand_total':   return '₹ ' + Number(bill.grand_total).toFixed(2);
      case 'payment_mode':  return bill.payment_mode || '—';
      default:              return '—';
    }
  }

  formatDate(val: string): string {
    if (!val) return '—';
    return new Date(val).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  /* ── Export CSV ── */
  exportCSV() {
    if (!this.bills.length) {
      this.toast.warn('No data', 'Load data before exporting.');
      return;
    }

    const headers = this.visibleColumns.map(c => `"${c.label}"`).join(',');
    const rows = this.bills.map(b =>
      this.visibleColumns
        .map(c => `"${this.cellValue(b, c.key).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `kovais-report-${this.startDate}-to-${this.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    this.toast.success('CSV Exported', 'Report downloaded successfully.');
  }

  /* ── Print ── */
  printReport() {
    if (!this.bills.length) {
      this.toast.warn('No data', 'Load data before printing.');
      return;
    }
    window.print();
  }
}
