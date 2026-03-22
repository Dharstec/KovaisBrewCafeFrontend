import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpendService } from '../../core/api/spend.api';
import { AuthApi } from '../../core/api/auth.api';

@Component({
  standalone: true,
  selector: 'app-spend-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './spend.page.html',
  styleUrls: ['./spend.page.scss']
})
export class SpendPage implements OnInit {
  auth = inject(AuthApi);

  isAdmin = this.auth.isAdmin();

  spendList: any[] = [];
  totalSpent = 0;
  rangeTotal = 0;
  totalCount = 0;
  totalPages: number[] = [];
  maxDate = '';

  startDate = '';
  endDate   = '';

  params = {
    page: 1,
    pageSize: 10,
    sortColumn: 'date',
    sortOrder: 'DESC' as 'ASC' | 'DESC',
    searchTerm: '',
  };

  form: any = {
    reason: '',
    amount: '',
    date: '',
    payment_mode: 'CASH'
  };

  showForm = false;
  isEdit   = false;

  /* ── Reason combobox ── */
  uniqueReasons:   string[] = [];
  filteredReasons: string[] = [];
  showReasonDrop   = false;
  reasonInput      = '';

  constructor(private spendApi: SpendService) {}

  ngOnInit() {
    this.setTodayDate();
    this.loadSpend();
    this.loadReasons();
  }

  loadReasons() {
    this.spendApi.getUniqueReasons().subscribe({
      next: res => { this.uniqueReasons = res; },
      error: () => {}
    });
  }

  onReasonInput() {
    this.form.reason     = this.reasonInput;
    const q              = this.reasonInput.trim().toLowerCase();
    this.filteredReasons = q
      ? this.uniqueReasons.filter(r => r.toLowerCase().includes(q))
      : [...this.uniqueReasons];
    this.showReasonDrop  = true;
  }

  onReasonFocus() {
    const q              = this.reasonInput.trim().toLowerCase();
    this.filteredReasons = q
      ? this.uniqueReasons.filter(r => r.toLowerCase().includes(q))
      : [...this.uniqueReasons];
    this.showReasonDrop  = true;
  }

  onReasonBlur() {
    /* Delay so mousedown on an option fires before blur hides the list */
    setTimeout(() => { this.showReasonDrop = false; }, 180);
  }

  selectReason(r: string) {
    this.reasonInput    = r;
    this.form.reason    = r;
    this.showReasonDrop = false;
  }

  /* After save, refresh reasons so new one appears next time */
  save() {
    this.spendApi.create(this.form).subscribe(() => {
      this.closeForm();
      this.loadSpend();
      this.loadReasons();
    });
  }

  update() {
    this.spendApi.update(this.form.id, this.form).subscribe(() => {
      this.closeForm();
      this.loadSpend();
      this.loadReasons();
    });
  }

  loadSpend() {
    this.spendApi.getAll(
      this.params.searchTerm,
      this.params.page,
      this.params.pageSize,
      this.params.sortColumn,
      this.params.sortOrder,
      this.startDate,
      this.endDate
    ).subscribe(res => {
      this.spendList  = res.data;
      this.totalSpent = res.total_spent_this_month;
      this.rangeTotal = res.range_total;
      this.totalCount = res.total_count;
      this.generatePages();
    });
  }

  generatePages() {
    const pages = Math.ceil(this.totalCount / this.params.pageSize);
    this.totalPages = Array.from({ length: pages }, (_, i) => i + 1);
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages.length) return;
    this.params.page = page;
    this.loadSpend();
  }

  search() {
    this.params.page = 1;
    this.loadSpend();
  }

  openAdd() {
    this.resetForm();
    this.form.date = this.maxDate;
    this.isEdit    = false;
    this.showForm  = true;
  }

  setTodayDate() {
    const today = new Date();
    const yyyy  = today.getFullYear();
    const mm    = String(today.getMonth() + 1).padStart(2, '0');
    const dd    = String(today.getDate()).padStart(2, '0');
    this.maxDate   = `${yyyy}-${mm}-${dd}`;
    this.form.date = this.maxDate;
    // Default filter: today
    this.startDate = this.maxDate;
    this.endDate   = this.maxDate;
  }

  applyFilter() {
    this.params.page = 1;
    this.loadSpend();
  }

  openEdit(item: any) {
    this.form = {
      id:           item.id,
      reason:       item.reason,
      amount:       item.amount,
      date:         this.toInputDate(item.spent_date),
      payment_mode: item.payment_mode || 'CASH'
    };
    this.reasonInput = item.reason;
    this.isEdit      = true;
    this.showForm    = true;
  }

  deleteSpend(id: number) {
    if (!confirm('Delete this spend?')) return;
    this.spendApi.delete(id).subscribe(() => this.loadSpend());
  }

  closeForm() {
    this.showForm       = false;
    this.showReasonDrop = false;
    this.resetForm();
  }

  resetForm() {
    this.form = {
      reason:       '',
      amount:       '',
      date:         this.maxDate,
      payment_mode: 'CASH'
    };
    this.reasonInput    = '';
    this.showReasonDrop = false;
  }

  toInputDate(ddmmyyyy: string) {
    const [dd, mm, yyyy] = ddmmyyyy.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
}
