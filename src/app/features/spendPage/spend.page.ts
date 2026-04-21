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

  showForm    = false;
  isEdit      = false;
  activeSpendId: number | null = null;

  /* ── Split payments ── */
  payments: any[]  = [];
  paymentForm = { payment_date: '', amount: null as number | null, payment_mode: 'CASH', note: '' };
  paymentError  = '';
  paymentLoading = false;

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

  save() {
    this.spendApi.create(this.form).subscribe((res: any) => {
      const id = res.id ?? res.data?.id ?? null;
      const amt = this.paymentForm.amount;
      if (id && amt && Number(amt) > 0) {
        this.spendApi.addPayment(id, {
          payment_date: this.paymentForm.payment_date || this.maxDate,
          amount:       Number(amt),
          payment_mode: this.paymentForm.payment_mode,
          note:         this.paymentForm.note || undefined
        }).subscribe(() => {
          this.loadSpend();
          this.loadReasons();
          this.closeForm();
        });
      } else {
        this.loadSpend();
        this.loadReasons();
        this.closeForm();
      }
    });
  }

  update() {
    this.spendApi.update(this.form.id, this.form).subscribe(() => {
      this.loadSpend();
      this.loadReasons();
    });
  }

  /* ── Payments ── */
  loadPayments(spentId: number) {
    this.spendApi.getPayments(spentId).subscribe({
      next: rows => { this.payments = rows; },
      error: () => {}
    });
  }

  get totalPaid(): number {
    return this.payments.reduce((s, p) => s + Number(p.amount), 0);
  }

  get amountDue(): number {
    return Math.max(0, Number(this.form.amount || 0) - this.totalPaid);
  }

  addPayment() {
    if (!this.paymentForm.payment_date) { this.paymentError = 'Select payment date'; return; }
    if (!this.paymentForm.amount || this.paymentForm.amount <= 0) { this.paymentError = 'Enter amount'; return; }
    if (!this.activeSpendId) { this.paymentError = 'Save the spend record first'; return; }

    this.paymentError   = '';
    this.paymentLoading = true;

    this.spendApi.addPayment(this.activeSpendId, {
      payment_date: this.paymentForm.payment_date,
      amount:       this.paymentForm.amount,
      payment_mode: this.paymentForm.payment_mode,
      note:         this.paymentForm.note || undefined
    }).subscribe({
      next: () => {
        this.paymentLoading = false;
        this.paymentForm    = { payment_date: this.maxDate, amount: null, payment_mode: 'CASH', note: '' };
        this.loadPayments(this.activeSpendId!);
        this.loadSpend();
      },
      error: err => {
        this.paymentLoading = false;
        this.paymentError   = err.error?.message || 'Failed to add payment';
      }
    });
  }

  removePayment(paymentId: number) {
    if (!confirm('Remove this payment?')) return;
    this.spendApi.deletePayment(this.activeSpendId!, paymentId).subscribe(() => {
      this.loadPayments(this.activeSpendId!);
      this.loadSpend();
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
    this.reasonInput   = item.reason;
    this.activeSpendId = item.id;
    this.isEdit        = true;
    this.showForm      = true;
    this.payments      = [];
    this.paymentError  = '';
    this.paymentForm   = { payment_date: this.maxDate, amount: null, payment_mode: 'CASH', note: '' };
    this.loadPayments(item.id);
  }

  deleteSpend(id: number) {
    if (!confirm('Delete this spend?')) return;
    this.spendApi.delete(id).subscribe(() => this.loadSpend());
  }

  closeForm() {
    this.showForm       = false;
    this.showReasonDrop = false;
    this.activeSpendId  = null;
    this.payments       = [];
    this.paymentError   = '';
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
