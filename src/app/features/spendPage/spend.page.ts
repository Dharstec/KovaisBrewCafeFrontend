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
export class SpendPage  {
  auth = inject(AuthApi);

  isAdmin = this.auth.isAdmin();

  spendList: any[] = [];
  totalSpent = 0;
  totalCount = 0;
  totalPages: number[] = [];
  maxDate = '';

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
  isEdit = false;

  constructor(private spendApi: SpendService) { }

  ngOnInit() {
    this.setTodayDate();   
    this.loadSpend();
  }

  loadSpend() {
    this.spendApi.getAll(
      this.params.searchTerm,
      this.params.page,
      this.params.pageSize,
      this.params.sortColumn,
      this.params.sortOrder
    ).subscribe(res => {
      this.spendList = res.data;
      this.totalSpent = res.total_spent_this_month;
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
    this.isEdit = false;
    this.showForm = true;
  }

  setTodayDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    this.maxDate = `${yyyy}-${mm}-${dd}`;

    this.form.date = this.maxDate;
  }

  openEdit(item: any) {
    this.form = {
      id:item.id,
      reason: item.reason,
      amount: item.amount,
      date: this.toInputDate(item.spent_date),
      payment_mode: item.payment_mode || 'CASH'
    };
    this.isEdit = true;
    this.showForm = true;
  }

  save() {
    this.spendApi.create(this.form).subscribe(() => {
      this.closeForm();
      this.loadSpend();
    });
  }

  update() {
    this.spendApi.update(this.form.id, this.form).subscribe(() => {
      this.closeForm();
      this.loadSpend();
    });
  }

  deleteSpend(id: number) {
    if (!confirm('Delete this spend?')) return;
    this.spendApi.delete(id).subscribe(() => this.loadSpend());
  }

  closeForm() {
    this.showForm = false;
    this.resetForm();
  }

  resetForm() {
    this.form = {
      reason: '',
      amount: '',
      date: this.maxDate,
      payment_mode: 'CASH'
    };
  }


  toInputDate(ddmmyyyy: string) {
    const [dd, mm, yyyy] = ddmmyyyy.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
}
