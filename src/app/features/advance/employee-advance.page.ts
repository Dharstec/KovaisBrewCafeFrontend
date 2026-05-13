import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-employee-advance',
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-advance.page.html',
  styleUrls: ['./employee-advance.page.scss']
})
export class EmployeeAdvancePage implements OnInit {

  http = inject(HttpClient);

  employees: any[] = [];
  history: any[] = [];

  employee_id: number | null = null;
  amount: number | null = null;
  advance_date = new Date().toISOString().slice(0, 10);
  note = '';

  ngOnInit() {
    this.loadEmployees();
  }

  loadEmployees() {
    this.http
      .get<any[]>(`${environment.apiUrl}/employee`)
      .subscribe(res => this.employees = res);
  }

  onEmployeeChange() {
    this.history = [];
    this.amount = null;
    this.note = '';

    if (this.employee_id) {
      this.loadHistory();
    }
  }

  loadHistory() {
    this.http.get<any[]>(
      `${environment.apiUrl}/employee-advance?employee_id=${this.employee_id}`
    ).subscribe(res => this.history = res);
  }

  canSave(): boolean {
    return !!(
      this.employee_id &&
      this.amount &&
      this.amount > 0 &&
      this.advance_date
    );
  }

  save() {
    if (!this.canSave()) return;

    this.http.post(
      `${environment.apiUrl}/employee-advance`,
      {
        employee_id: this.employee_id,
        amount: this.amount,
        advance_date: this.advance_date,
        note: this.note
      }
    ).subscribe(() => {
      this.amount = null;
      this.note = '';
      this.loadHistory();
      alert('Advance saved successfully');
    });
  }

  deleteAdvance(id: number, amount: number) {
    if (!confirm(`Delete advance of ₹${amount}? This cannot be undone.`)) return;

    this.http.delete(`${environment.apiUrl}/employee-advance/${id}`)
      .subscribe({
        next: () => this.loadHistory(),
        error: () => alert('Failed to delete advance. Please try again.')
      });
  }
}
