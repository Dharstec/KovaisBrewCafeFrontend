import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface SalaryRow {
  employee_id:       number;
  employee_name:     string;
  base_salary:       number;
  total_days:        number;
  working_days:      number;   // total_days − WO − HL
  weekly_off_days:   number;
  daily_rate:        number;
  present_days:      number;
  absent_days:       number;
  half_days:         number;
  late_days:         number;
  holiday_days:      number;
  absent_deduction:  number;
  half_deduction:    number;
  advance_deduction: number;
  net_payable:       number;
  finalized:         boolean;
}

interface HistoryRecord {
  id:                number;
  employee_id:       number;
  employee_name:     string;
  month:             string;
  base_salary:       number;
  total_days:        number;
  working_days:      number;
  weekly_off_days:   number;
  daily_rate:        number;
  present_days:      number;
  absent_days:       number;
  half_days:         number;
  late_days:         number;
  holiday_days:      number;
  absent_deduction:  number;
  half_deduction:    number;
  advance_deduction: number;
  net_payable:       number;
  finalized_at:      string;
}

type View = 'preview' | 'history';

@Component({
  standalone: true,
  selector: 'app-salary-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './salary.page.html',
  styleUrls: ['./salary.page.scss']
})
export class SalaryPage implements OnInit {
  private http = inject(HttpClient);

  view: View = 'preview';

  // ── Preview ─────────────────────────────────────────────────────────────────
  previewMonth = new Date().toISOString().slice(0, 7);
  rows: SalaryRow[] = [];
  loading = false;
  finalizing = false;
  finalizeSuccess = false;
  alreadyFinalized = false;

  // ── History ─────────────────────────────────────────────────────────────────
  historyMonth  = '';
  historyMonths: string[] = [];
  historyRows: HistoryRecord[] = [];
  historyLoading = false;
  selectedHistEmp = '';
  historyEmployees: string[] = [];

  ngOnInit() {
    this.loadPreview();
  }

  setView(v: View) {
    this.view = v;
    if (v === 'history') this.loadHistoryMonths();
  }

  // ── Preview ──────────────────────────────────────────────────────────────────
  loadPreview() {
    this.loading = true;
    this.rows = [];
    this.http
      .get<{ month: string; employees: SalaryRow[] }>(
        `${environment.apiUrl}/salary/preview?month=${this.previewMonth}`
      )
      .subscribe({
        next: data => {
          this.rows = data.employees;
          this.alreadyFinalized = this.rows.some(r => r.finalized);
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  // Recompute net when advance is edited
  recalc(row: SalaryRow) {
    row.net_payable = parseFloat(
      Math.max(0,
        row.base_salary - row.absent_deduction - row.half_deduction - (row.advance_deduction || 0)
      ).toFixed(2)
    );
  }

  finalize() {
    if (!confirm(`Finalize salary for ${this.previewMonth}? This will lock the records.`)) return;
    this.finalizing = true;
    const payload = {
      month: this.previewMonth,
      employees: this.rows.map(r => ({
        employee_id:       r.employee_id,
        advance_deduction: r.advance_deduction || 0
      }))
    };
    this.http.post(`${environment.apiUrl}/salary/finalize`, payload).subscribe({
      next: () => {
        this.finalizing      = false;
        this.finalizeSuccess = true;
        this.loadPreview();
        setTimeout(() => (this.finalizeSuccess = false), 3000);
      },
      error: () => { this.finalizing = false; }
    });
  }

  // ── History ───────────────────────────────────────────────────────────────
  loadHistoryMonths() {
    this.http.get<string[]>(`${environment.apiUrl}/salary/months`).subscribe(months => {
      this.historyMonths = months;
      if (months.length > 0) {
        this.historyMonth = months[0];
        this.loadHistory();
      }
    });
  }

  loadHistory() {
    if (!this.historyMonth) return;
    this.historyLoading = true;
    this.historyRows = [];
    this.http
      .get<HistoryRecord[]>(`${environment.apiUrl}/salary/history`)
      .subscribe({
        next: data => {
          const filtered = data.filter(r => r.month === this.historyMonth);
          this.historyRows = filtered;
          this.historyEmployees = [...new Set(filtered.map(r => r.employee_name))];
          this.historyLoading = false;
        },
        error: () => { this.historyLoading = false; }
      });
  }

  get filteredHistory(): HistoryRecord[] {
    if (!this.selectedHistEmp) return this.historyRows;
    return this.historyRows.filter(r => r.employee_name === this.selectedHistEmp);
  }

  get totalNetPayable(): number {
    return this.filteredHistory.reduce((s, r) => s + +r.net_payable, 0);
  }

  get previewTotalNet(): number {
    return this.rows.reduce((s, r) => s + r.net_payable, 0);
  }

  get formulaTotalDays(): number {
    return this.rows.length ? this.rows[0].total_days : 0;
  }

  monthLabel(m: string): string {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  fmt(n: number): string {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
