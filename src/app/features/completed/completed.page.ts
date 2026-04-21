import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillApi } from '../../core/api/bill.api';
import { AuthApi } from '../../core/api/auth.api';
import { ToastService } from '../../core/services/toast.service';

@Component({
  standalone: true,
  selector: 'app-completed-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './completed.page.html',
  styleUrls: ['./completed.page.scss']
})
export class CompletedPage implements OnInit {

  auth  = inject(AuthApi);
  toast = inject(ToastService);

  bills: any[] = [];

  /* ROLE */
  isAdmin = this.auth.isAdmin();

  /* DATE FILTER */
  startDate = '';
  endDate   = '';

  /* PAGINATION */
  page       = 1;
  limit      = 20;
  totalPages = 1;
  pages: number[] = [];

  /* PLATFORM TABS */
  platformFilter = '';

  /* TOTALS */
  cashTotal    = 0;
  upiTotal     = 0;
  zomatoTotal  = 0;
  swiggyTotal  = 0;
  grandTotal   = 0;

  /* PRINT */
  printBillData: any = null;

  constructor(private api: BillApi) { }

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];
    this.startDate = today;
    this.endDate   = today;
    this.loadBills();
  }

  loadBills() {
    this.api.completed(
      this.startDate,
      this.endDate,
      this.page,
      this.limit,
      this.platformFilter || undefined
    ).subscribe({
      next: res => {
        this.bills        = res.data;
        this.totalPages   = res.totalPages;
        this.pages        = Array.from({ length: this.totalPages }, (_, i) => i + 1);
        this.cashTotal    = Number(res.summary?.cash_total    || 0);
        this.upiTotal     = Number(res.summary?.upi_total     || 0);
        this.zomatoTotal  = Number(res.summary?.zomato_total  || 0);
        this.swiggyTotal  = Number(res.summary?.swiggy_total  || 0);
        this.grandTotal   = Number(res.summary?.grand_total   || 0);
      },
      error: () => this.toast.error('Load failed', 'Could not fetch completed bills.')
    });
  }

  setplatformFilter(p: string) {
    this.platformFilter = p;
    this.page = 1;
    this.loadBills();
  }

  /* ADMIN ONLY */
  applyDateFilter() {
    this.page = 1;
    this.loadBills();
  }

  /* PAGINATION */
  goTo(p: number) { this.page = p; this.loadBills(); }
  next() { if (this.page < this.totalPages) { this.page++; this.loadBills(); } }
  prev() { if (this.page > 1)              { this.page--; this.loadBills(); } }

  /* PRINT RECEIPT */
  printBill(bill: any) {
    this.printBillData = bill;
    setTimeout(() => {
      window.print();
      // keep printBillData so receipt stays rendered for print
    }, 100);
  }
}
