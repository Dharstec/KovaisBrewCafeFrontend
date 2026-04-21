import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthApi } from '../../core/api/auth.api';

export type AttStatus = 'P' | 'A' | 'H' | 'L' | 'HL' | 'WO';

export const STATUS_META: Record<AttStatus, { label: string; color: string; bg: string }> = {
  P:  { label: 'Present',     color: '#16a34a', bg: '#dcfce7' },
  A:  { label: 'Absent',      color: '#ef4444', bg: '#fee2e2' },
  H:  { label: 'Half Day',    color: '#d97706', bg: '#fef3c7' },
  L:  { label: 'Late',        color: '#ea580c', bg: '#ffedd5' },
  HL: { label: 'Holiday',     color: '#0369a1', bg: '#e0f2fe' },
  WO: { label: 'Weekly Off',  color: '#6b7280', bg: '#f3f4f6' },
};

interface MarkRow {
  employee_id: number;
  name: string;
  status: AttStatus;
  date: string;
  check_in?: string;
  check_out?: string;
}

interface ReportCell {
  date: string;
  status: AttStatus;
  check_in: string | null;
  check_out: string | null;
}

interface ReportEmployee {
  employee_id: number;
  employee_name: string;
  cells: Record<string, ReportCell>;
  counts: Record<AttStatus, number>;
  attendance_pct: number;
}

type View = 'mark' | 'report';

@Component({
  standalone: true,
  selector: 'app-attendance-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.page.html',
  styleUrls: ['./attendance.page.scss']
})
export class AttendancePage implements OnInit {

  private http = inject(HttpClient);
  auth = inject(AuthApi);

  isAdmin    = this.auth.isAdmin();
  view: View = 'mark';

  STATUS_META = STATUS_META;
  statuses: AttStatus[] = ['P', 'A', 'H', 'L', 'HL', 'WO'];

  // ── Mark tab ────────────────────────────────────────────────────────────────
  markDate   = new Date().toISOString().slice(0, 10);
  markList: MarkRow[] = [];
  markSaving = false;
  saveSuccess = false;

  todayStats = { P: 0, A: 0, H: 0, L: 0, HL: 0, WO: 0, total: 0 };

  // Employee list (populated on first loadMark, used in report filter)
  allEmployees: { id: number; name: string }[] = [];

  // ── Report tab ──────────────────────────────────────────────────────────────
  reportMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  reportStart = '';
  reportEnd   = '';
  selectedEmpId = '';
  reportLoading = false;
  reportEmployees: ReportEmployee[] = [];
  reportDates: string[] = [];

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadMark();
  }

  setView(v: View) {
    this.view = v;
    if (v === 'report') {
      this.loadReport();
    }
  }

  // ── Mark ─────────────────────────────────────────────────────────────────────
  loadMark() {
    this.http
      .get<MarkRow[]>(`${environment.apiUrl}/attendance?date=${this.markDate}`)
      .subscribe(res => {
        this.markList = res.map(r => ({ ...r, date: this.markDate }));
        if (this.allEmployees.length === 0) {
          this.allEmployees = res.map(r => ({ id: r.employee_id, name: r.name }));
        }
        this.computeStats();
      });
  }

  saveMark() {
    this.markSaving = true;
    this.http.post(`${environment.apiUrl}/attendance`, this.markList).subscribe({
      next: () => {
        this.markSaving  = false;
        this.saveSuccess = true;
        this.computeStats();
        setTimeout(() => (this.saveSuccess = false), 2500);
      },
      error: () => { this.markSaving = false; }
    });
  }

  hasTime(s: AttStatus): boolean {
    return s === 'P' || s === 'H' || s === 'L';
  }

  computeStats() {
    const c: any = { P: 0, A: 0, H: 0, L: 0, HL: 0, WO: 0, total: this.markList.length };
    for (const r of this.markList) c[r.status]++;
    this.todayStats = c;
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  loadReport() {
    const [y, m] = this.reportMonth.split('-').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
    this.reportStart = `${y}-${pad(m)}-01`;
    this.reportEnd   = `${y}-${pad(m)}-${pad(lastDay)}`;

    this.reportLoading  = true;
    this.reportEmployees = [];
    const url = `${environment.apiUrl}/attendance/history?start=${this.reportStart}&end=${this.reportEnd}`;
    this.http.get<{ start: string; end: string; employees: any[] }>(url).subscribe({
      next: data => {
        this.buildGrid(data);
        this.reportLoading = false;
      },
      error: () => { this.reportLoading = false; }
    });
  }

  buildGrid(data: { employees: any[] }) {
    // Generate date array for column headers
    const dates: string[] = [];
    let cur = this.reportStart;
    while (cur <= this.reportEnd) {
      dates.push(cur);
      const [cy, cm, cd] = cur.split('-').map(Number);
      const next = new Date(cy, cm - 1, cd + 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      cur = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
    }
    this.reportDates = dates;

    this.reportEmployees = data.employees.map(emp => {
      const cells: Record<string, ReportCell> = {};
      for (const r of emp.records) {
        const d = (typeof r.date === 'string' ? r.date : new Date(r.date).toISOString()).slice(0, 10);
        cells[d] = { date: d, status: r.status, check_in: r.check_in, check_out: r.check_out };
      }
      return {
        employee_id:    emp.employee_id,
        employee_name:  emp.employee_name,
        cells,
        counts:         emp.counts  || { P: 0, A: 0, H: 0, L: 0, HL: 0, WO: 0 },
        attendance_pct: emp.attendance_pct || 0
      };
    });

    // Merge any employees from allEmployees not returned (they have no records)
    // so the filter dropdown stays populated
    for (const e of this.allEmployees) {
      const exists = this.reportEmployees.some(r => r.employee_id === e.id);
      if (!exists) {
        this.reportEmployees.push({
          employee_id: e.id, employee_name: e.name,
          cells: {}, counts: { P: 0, A: 0, H: 0, L: 0, HL: 0, WO: 0 }, attendance_pct: 0
        });
      }
    }
  }

  get filteredReport(): ReportEmployee[] {
    if (!this.selectedEmpId) return this.reportEmployees;
    return this.reportEmployees.filter(e => e.employee_id === +this.selectedEmpId);
  }

  get avgAttendance(): number {
    const emps = this.reportEmployees.filter(e => Object.keys(e.cells).length > 0);
    if (!emps.length) return 0;
    return Math.round(emps.reduce((sum, e) => sum + e.attendance_pct, 0) / emps.length);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  dayNum(d: string): string {
    return new Date(d + 'T12:00:00').getDate().toString();
  }

  dayName(d: string): string {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2);
  }

  isWeekend(d: string): boolean {
    const day = new Date(d + 'T12:00:00').getDay();
    return day === 0 || day === 6;
  }

  cellTip(cell: ReportCell): string {
    const meta = STATUS_META[cell.status];
    let t = meta.label;
    if (cell.check_in)  t += ` | In: ${cell.check_in}`;
    if (cell.check_out) t += ` | Out: ${cell.check_out}`;
    return t;
  }
}
