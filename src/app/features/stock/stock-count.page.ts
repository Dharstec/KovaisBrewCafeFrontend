import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockApi } from '../../core/api/stock.api';
import { AuthApi } from '../../core/api/auth.api';
import { ToastService } from '../../core/services/toast.service';

interface Row {
  stock_item_id: number;
  name: string;
  category_id: number | null;
  category_name: string;
  base_unit: string;
  unit_label: string;
  min_display: string;
  system_qty: number;
  opening_qty: number;
  purchase_qty: number;
  billed_qty: number;
  expected_closing: number | null;
  count_id: number | null;
  closing_qty: number | null;
  variance: number | null;
  locked: boolean;
  note: string | null;

  opening_input: string;
  purchase_input: string;
  closing_input: string;
  note_input: string;
  min_qty_input: string;
  dirty: boolean;
  auto_filled: boolean;
}
interface Group { name: string; category_id: number | null; items: Row[]; addOpen?: boolean; addForm?: NewItemForm; }
interface NewItemForm { name: string; unit_label: string; min_qty: string; saving: boolean; }
interface CategoryOpt { id: number; name: string; }

@Component({
  selector: 'app-stock-count',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-count.page.html'
})
export class StockCountPage implements OnInit {
  private api   = inject(StockApi);
  private auth  = inject(AuthApi);
  private toast = inject(ToastService);

  isAdmin = this.auth.isAdmin();
  loading = true;
  saving  = false;

  date = new Date().toISOString().slice(0, 10);
  alreadySubmitted = false;
  groups: Group[] = [];
  search = '';

  categories: CategoryOpt[] = [];

  // Top-level quick-add modal
  topAddOpen = false;
  topAdd: { name: string; category_id: number | null; unit_label: string; min_qty: string; saving: boolean } = {
    name: '', category_id: null, unit_label: 'Pcs', min_qty: '', saving: false
  };

  ngOnInit() {
    this.loadCategories();
    this.load();
  }

  loadCategories() {
    this.api.getCategories().subscribe({
      next: (res: any) => { this.categories = res?.data || []; },
      error: () => {}
    });
  }

  load() {
    this.loading = true;
    this.api.getCountToday(this.date).subscribe({
      next: (res: any) => {
        this.alreadySubmitted = res.already_submitted;
        this.groups = (res.groups || []).map((g: any) => ({
          name: g.name,
          category_id: g.category_id ?? null,
          items: (g.items || []).map((it: any) => this.toRow(it)),
          addOpen: false,
          addForm: { name: '', unit_label: 'Pcs', min_qty: '', saving: false }
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Failed to load'); }
    });
  }

  private toRow(it: any): Row {
    const opening = Number(it.opening_qty || 0);
    const expectedClosing = it.expected_closing != null ? Number(it.expected_closing) : null;
    const hasSavedClosing = it.closing_qty != null;

    // Pre-fill closing with expected (opening+purchase-billed) when no count saved yet
    let closingInput = '';
    let autoFilled = false;
    if (hasSavedClosing) {
      closingInput = String(it.closing_qty);
    } else if (expectedClosing != null && expectedClosing >= 0) {
      closingInput = String(expectedClosing);
      autoFilled = true;
    }

    return {
      stock_item_id: it.stock_item_id,
      name: it.name,
      category_id: it.category_id,
      category_name: it.category_name,
      base_unit: it.base_unit,
      unit_label: it.unit_label,
      min_display: it.min_display || '',
      system_qty: Number(it.system_qty || 0),
      opening_qty: opening,
      purchase_qty: Number(it.purchase_qty || 0),
      billed_qty: Number(it.billed_qty || 0),
      expected_closing: expectedClosing,
      count_id: it.count_id || null,
      closing_qty: hasSavedClosing ? Number(it.closing_qty) : null,
      variance: it.variance != null ? Number(it.variance) : null,
      locked: !!it.locked,
      note: it.note || null,
      opening_input: String(opening),
      purchase_input: it.purchase_qty > 0 ? String(it.purchase_qty) : '',
      closing_input: closingInput,
      note_input: it.note || '',
      min_qty_input: it.min_qty != null ? String(it.min_qty) : '0',
      dirty: false,
      auto_filled: autoFilled
    };
  }

  changeDate() { this.load(); }
  shiftDate(days: number) {
    const d = new Date(this.date);
    d.setDate(d.getDate() + days);
    this.date = d.toISOString().slice(0, 10);
    this.load();
  }
  setToday() {
    this.date = new Date().toISOString().slice(0, 10);
    this.load();
  }

  private get searchTerm(): string {
    return (this.search || '').toLowerCase().trim();
  }

  visibleItemsFor(g: Group): Row[] {
    const s = this.searchTerm;
    if (!s) return g.items;
    // match category name OR item name
    if (g.name.toLowerCase().includes(s)) return g.items;
    return g.items.filter(r => r.name.toLowerCase().includes(s));
  }

  shouldShowGroup(g: Group): boolean {
    if (!this.searchTerm) return true;
    if (g.addOpen) return true;
    return this.visibleItemsFor(g).length > 0;
  }

  hasAnyResults(): boolean {
    return this.groups.some(g => this.shouldShowGroup(g));
  }

  clearSearch() { this.search = ''; }

  markDirty(r: Row) { r.dirty = true; }

  computeVariance(r: Row): number | null {
    if (r.closing_input === '' || isNaN(Number(r.closing_input))) return null;
    // Variance = closing - (opening + purchase)
    const opening  = Number(r.opening_input || r.opening_qty || 0);
    const purchase = Number(r.purchase_input || 0);
    const expected = opening + purchase;
    return Number(r.closing_input) - expected;
  }

  fillSame(r: Row) {
    const opening  = Number(r.opening_input || r.opening_qty || 0);
    const purchase = Number(r.purchase_input || 0);
    r.closing_input = String(opening + purchase);
    r.dirty = true;
  }

  fillAll() {
    for (const g of this.groups)
      for (const r of g.items)
        if (!r.locked || this.isAdmin) this.fillSame(r);
  }

  get totalDirty(): number {
    let n = 0;
    for (const g of this.groups) for (const r of g.items) if (r.dirty) n++;
    return n;
  }

  saveAll() {
    const items: any[] = [];
    for (const g of this.groups) {
      for (const r of g.items) {
        if (!r.dirty) continue;
        if (r.locked && !this.isAdmin) continue;
        if (r.closing_input === '' || isNaN(Number(r.closing_input))) continue;
        const purchase = r.purchase_input === '' ? 0 : Number(r.purchase_input);
        items.push({
          stock_item_id: r.stock_item_id,
          closing_qty: Number(r.closing_input),
          purchase_qty: purchase > 0 ? purchase : 0,
          opening_qty: this.isAdmin && r.opening_input !== '' ? Number(r.opening_input) : undefined,
          note: r.note_input?.trim() || undefined
        });
      }
    }
    if (!items.length) {
      this.toast.error('Nothing to save — enter at least one closing count');
      return;
    }
    this.saving = true;
    const payload: any = { items };
    if (this.isAdmin) payload.count_date = this.date;
    this.api.saveCount(payload).subscribe({
      next: () => {
        this.toast.success(`Saved ${items.length} item(s)`);
        this.saving = false;
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Save failed');
      }
    });
  }

  updateMinQty(r: Row) {
    const val = Number(r.min_qty_input);
    if (isNaN(val) || val < 0) return;
    this.api.updateStockItem(r.stock_item_id, { min_qty: val }).subscribe({
      next: () => this.toast.success(`Min stock updated for ${r.name}`),
      error: () => this.toast.error('Failed to update min stock')
    });
  }

  unlockRow(id: number) {
    if (!confirm('Unlock this row so it can be edited?')) return;
    this.api.unlockCountRow(id).subscribe({
      next: () => { this.toast.success('Unlocked'); this.load(); }
    });
  }

  /* ── Top-level + New Item modal ── */
  openTopAdd() {
    this.topAdd = { name: '', category_id: this.categories[0]?.id || null, unit_label: 'Pcs', min_qty: '', saving: false };
    this.topAddOpen = true;
  }
  closeTopAdd() { this.topAddOpen = false; }

  saveTopAdd() {
    if (!this.topAdd.name.trim()) { this.toast.error('Name required'); return; }
    this.topAdd.saving = true;
    this.api.quickAddStockItem({
      name: this.topAdd.name.trim(),
      category_id: this.topAdd.category_id,
      unit_label: this.topAdd.unit_label || 'Pcs',
      base_unit:  this.topAdd.unit_label || 'Pcs',
      unit_value: 1,
      min_qty:    this.topAdd.min_qty ? Number(this.topAdd.min_qty) : 0
    }).subscribe({
      next: () => {
        this.toast.success('Item added');
        this.topAddOpen = false;
        this.topAdd.saving = false;
        this.load();
      },
      error: (err) => {
        this.topAdd.saving = false;
        this.toast.error(err?.error?.message || 'Failed to add');
      }
    });
  }

  /* ── Inline add new item ── */
  toggleAdd(g: Group) {
    g.addOpen = !g.addOpen;
    if (g.addOpen) g.addForm = { name: '', unit_label: 'Pcs', min_qty: '', saving: false };
  }

  saveNewItem(g: Group) {
    if (!g.addForm) return;
    const f = g.addForm;
    if (!f.name.trim()) { this.toast.error('Name required'); return; }
    f.saving = true;
    this.api.quickAddStockItem({
      name: f.name.trim(),
      category_id: g.category_id ?? null,
      unit_label: f.unit_label || 'Pcs',
      base_unit: f.unit_label || 'Pcs',
      unit_value: 1,
      min_qty: f.min_qty ? Number(f.min_qty) : 0
    }).subscribe({
      next: () => {
        this.toast.success('Item added');
        f.saving = false;
        g.addOpen = false;
        this.load();
      },
      error: (err) => {
        f.saving = false;
        this.toast.error(err?.error?.message || 'Failed to add');
      }
    });
  }
}
