import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TargetApi } from '../../core/api/target.api';
import { SpendService } from '../../core/api/spend.api';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-targets',
  imports: [CommonModule, FormsModule],
  templateUrl: './targets.page.html',
  styleUrls: ['./targets.page.scss']
})
export class TargetsPage implements OnInit {
  private api      = inject(TargetApi);
  private spendApi = inject(SpendService);
  private http     = inject(HttpClient);

  view: 'list' | 'detail' = 'list';
  targets: any[] = [];
  selected: any = null;
  achievement: any = null;
  loading = false;
  loadingAchieve = false;

  showCreateForm = false;
  createForm: any = { name: 'Monthly Target', start_date: '', end_date: '', sales_target: 0 };
  creating = false;

  editMode = false;
  editForm: any = {};

  newItem = { item_name: '', target_amount: '' };
  addingItem = false;

  get activeEmployees(): any[] {
    return this.employees.filter(e => e.is_active);
  }

  showAdvances: Record<number, boolean> = {};

  toggleAdvances(itemId: number) {
    this.showAdvances[itemId] = !this.showAdvances[itemId];
  }

  itemAdvances(itemName: string): any[] {
    const kw = itemName.toLowerCase();
    return (this.achievement?.advance_list || []).filter((a: any) =>
      a.employee_name.toLowerCase().includes(kw) ||
      kw.includes(a.employee_name.toLowerCase().split(' ')[0])
    );
  }

  itemAdvanceTotal(itemName: string): number {
    return this.itemAdvances(itemName).reduce((s: number, a: any) => s + +a.amount, 0);
  }

  // Quick pay form
  payForm: { itemId: number; item_name: string; amount: string; date: string; payment_mode: string } | null = null;
  paying = false;

  // Employee advance form
  employees: any[] = [];
  advForm: { itemId: number; item_name: string; employee_id: number | null; amount: string; date: string; note: string } | null = null;
  addingAdvance = false;

  ngOnInit() {
    this.initDates();
    this.loadList();
    this.loadEmployees();
  }

  loadEmployees() {
    this.http.get<any[]>(`${environment.apiUrl}/employee`)
      .subscribe({ next: d => this.employees = d, error: () => {} });
  }

  initDates() {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed
    this.createForm.start_date = `${y}-${String(m + 1).padStart(2, '0')}-07`;
    const nm = m + 2 > 12 ? 1 : m + 2;
    const ny = m + 2 > 12 ? y + 1 : y;
    this.createForm.end_date = `${ny}-${String(nm).padStart(2, '0')}-07`;
  }

  loadList() {
    this.loading = true;
    this.api.getAll().subscribe({
      next: d => { this.targets = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openDetail(t: any) {
    this.selected = t;
    this.editForm = {
      ...t,
      start_date: t.start_date?.slice(0, 10),
      end_date:   t.end_date?.slice(0, 10)
    };
    this.view = 'detail';
    this.api.getById(t.id).subscribe({ next: d => { this.selected = d; } });
    this.loadAchieve(t.id);
  }

  loadAchieve(id: number) {
    this.loadingAchieve = true;
    this.achievement = null;
    this.api.getAchievement(id).subscribe({
      next: d => { this.achievement = d; this.loadingAchieve = false; },
      error: () => { this.loadingAchieve = false; }
    });
  }

  goBack() {
    this.view = 'list';
    this.selected = null;
    this.achievement = null;
    this.editMode = false;
  }

  createTarget() {
    if (!this.createForm.start_date || !this.createForm.end_date) return;
    this.creating = true;
    this.api.create(this.createForm).subscribe({
      next: () => { this.showCreateForm = false; this.creating = false; this.loadList(); },
      error: () => { this.creating = false; }
    });
  }

  saveEdit() {
    this.api.update(this.selected.id, this.editForm).subscribe({
      next: d => {
        this.selected = { ...d, items: this.selected.items };
        this.editForm = { ...d };
        this.editMode = false;
        this.loadAchieve(d.id);
        this.loadList();
      }
    });
  }

  deleteTarget(id: number, e: Event) {
    e.stopPropagation();
    if (!confirm('Delete this target period?')) return;
    this.api.delete(id).subscribe({
      next: () => { this.targets = this.targets.filter(t => t.id !== id); }
    });
  }

  addItem() {
    if (!this.newItem.item_name || !this.newItem.target_amount) return;
    this.addingItem = true;
    this.api.addItem(this.selected.id, {
      item_name: this.newItem.item_name,
      target_amount: +this.newItem.target_amount
    }).subscribe({
      next: item => {
        this.selected.items = [...(this.selected.items || []), item];
        this.newItem = { item_name: '', target_amount: '' };
        this.addingItem = false;
        this.loadAchieve(this.selected.id);
      },
      error: () => { this.addingItem = false; }
    });
  }

  removeItem(itemId: number) {
    this.api.deleteItem(this.selected.id, itemId).subscribe({
      next: () => {
        this.selected.items = this.selected.items.filter((i: any) => i.id !== itemId);
        this.loadAchieve(this.selected.id);
      }
    });
  }

  // ── Quick Pay ────────────────────────────────────

  openPay(item: any) {
    if (this.payForm?.itemId === item.id) { this.payForm = null; return; }
    const today = new Date().toISOString().slice(0, 10);
    this.advForm = null;
    this.payForm = {
      itemId: item.id,
      item_name: item.item_name,
      amount: '',
      date: today,
      payment_mode: 'CASH'
    };
  }

  closePay() { this.payForm = null; }

  // ── Employee Advance ─────────────────────────────

  openAdvance(item: any) {
    if (this.advForm?.itemId === item.id) { this.advForm = null; return; }
    const today = new Date().toISOString().slice(0, 10);
    const match = this.employees.find(e =>
      e.name.toLowerCase().includes(item.item_name.toLowerCase()) ||
      item.item_name.toLowerCase().includes(e.name.toLowerCase())
    );
    this.payForm = null;
    this.advForm = {
      itemId: item.id,
      item_name: item.item_name,
      employee_id: match?.id ?? null,
      amount: '',
      date: today,
      note: ''
    };
  }

  closeAdvance() { this.advForm = null; }

  submitAdvance() {
    if (!this.advForm || !this.advForm.amount || !this.advForm.employee_id) return;
    this.addingAdvance = true;
    this.http.post(`${environment.apiUrl}/employee-advance`, {
      employee_id: this.advForm.employee_id,
      amount: +this.advForm.amount,
      advance_date: this.advForm.date,
      note: this.advForm.note || null
    }).subscribe({
      next: () => {
        this.addingAdvance = false;
        this.advForm = null;
        this.loadAchieve(this.selected.id);
      },
      error: () => { this.addingAdvance = false; }
    });
  }

  submitPay() {
    if (!this.payForm || !this.payForm.amount) return;
    this.paying = true;
    this.spendApi.create({
      reason: this.payForm.item_name,
      amount: +this.payForm.amount,
      date: this.payForm.date,
      payment_mode: this.payForm.payment_mode
    }).subscribe({
      next: () => {
        this.paying = false;
        this.payForm = null;
        this.loadAchieve(this.selected.id);
      },
      error: () => { this.paying = false; }
    });
  }

  // ── Helpers ──────────────────────────────────────

  itemActual(id: number): number {
    return +(this.achievement?.item_actuals?.[id] ?? 0);
  }

  get totalBudget(): number {
    return (this.selected?.items || []).reduce((s: number, i: any) => s + +i.target_amount, 0);
  }

  get totalActualExpenses(): number {
    return +(this.achievement?.total_expenses ?? 0);
  }

  // remaining budget per day (how much they can still spend per day)
  dailyRemaining(itemId: number, targetAmt: number): number {
    const daysLeft = this.achievement?.days_left ?? 0;
    if (daysLeft <= 0) return 0;
    const remaining = targetAmt - this.itemActual(itemId);
    return remaining > 0 ? remaining / daysLeft : 0;
  }

  itemRemaining(itemId: number, targetAmt: number): number {
    return Math.max(0, targetAmt - this.itemActual(itemId));
  }

  pct(actual: number, target: number): number {
    if (!target) return 0;
    return Math.min(100, Math.round((actual / target) * 100));
  }

  barColor(actual: number, target: number): string {
    const p = target ? (actual / target) * 100 : 0;
    if (p >= 100) return '#ef4444';
    if (p >= 80)  return '#f59e0b';
    return '#10b981';
  }

  salesPct(): number {
    const s = this.achievement?.actual_sales ?? 0;
    const t = this.achievement?.sales_target ?? 0;
    if (!t) return 0;
    return Math.min(100, Math.round((s / t) * 100));
  }

  // "on track" based on budget coverage daily pace
  get onTrack(): boolean {
    if (!this.achievement) return true;
    return this.achievement.budget_on_track;
  }

  fmt(n: number | null | undefined): string {
    return '\u20B9' + (+(n ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  fmtDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
