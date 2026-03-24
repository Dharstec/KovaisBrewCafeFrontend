import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-employees',
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.page.html',
  styleUrls: ['./employees.page.scss']
})
export class EmployeesPage implements OnInit {
  private http = inject(HttpClient);

  employees: any[] = [];
  loading = false;

  showForm = false;
  saving = false;
  editingId: number | null = null;

  form = this.blankForm();

  ngOnInit() { this.load(); }

  blankForm() {
    return {
      name: '',
      join_date: new Date().toISOString().slice(0, 10),
      salary_type: 'MONTHLY',
      salary_amount: '',
      is_active: true
    };
  }

  load() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/employee`).subscribe({
      next: d => { this.employees = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openCreate() {
    this.editingId = null;
    this.form = this.blankForm();
    this.showForm = true;
  }

  openEdit(emp: any) {
    this.editingId = emp.id;
    this.form = {
      name: emp.name,
      join_date: emp.join_date?.slice(0, 10),
      salary_type: emp.salary_type,
      salary_amount: emp.salary_amount,
      is_active: emp.is_active
    };
    this.showForm = true;
  }

  cancel() {
    this.showForm = false;
    this.editingId = null;
    this.form = this.blankForm();
  }

  save() {
    if (!this.form.name || !this.form.join_date || !this.form.salary_amount) return;
    this.saving = true;
    const body = this.editingId ? { ...this.form, id: this.editingId } : this.form;
    this.http.post(`${environment.apiUrl}/employee`, body).subscribe({
      next: () => { this.saving = false; this.cancel(); this.load(); },
      error: () => { this.saving = false; }
    });
  }

  delete(emp: any) {
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    this.http.delete(`${environment.apiUrl}/employee/${emp.id}`).subscribe({
      next: () => { this.employees = this.employees.filter(e => e.id !== emp.id); }
    });
  }

  fmt(n: any) {
    return '₹' + (+n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  fmtDate(d: string) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
