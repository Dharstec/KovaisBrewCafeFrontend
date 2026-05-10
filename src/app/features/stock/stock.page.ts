import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthApi } from '../../core/api/auth.api';
import { StockApi } from '../../core/api/stock.api';
import { ToastService } from '../../core/services/toast.service';

type Tab = 'count' | 'stock' | 'purchases' | 'manage';
type StockFilter = 'all' | 'low' | 'out' | 'expiring';
type PurchaseView = 'history' | 'expiry';
type ManageView = 'items' | 'logs';

interface CountRow {
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

interface CountGroup {
  name: string;
  category_id: number | null;
  items: CountRow[];
  addOpen?: boolean;
  addForm?: { name: string; unit_label: string; min_qty: string; saving: boolean };
}

interface CategoryOpt { id: number; name: string; }

@Component({
  standalone: true,
  selector: 'app-stock-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './stock.page.html',
  styleUrls: ['./stock.page.scss']
})
export class StockPage implements OnInit {
  private route    = inject(ActivatedRoute);
  private auth     = inject(AuthApi);
  private stockApi = inject(StockApi);
  private toast    = inject(ToastService);

  isAdmin   = false;
  activeTab: Tab = 'count';

  /* ─── TAB: DAILY COUNT ─────────────────────────────────── */
  countLoading        = true;
  countSaving         = false;
  countDate           = new Date().toISOString().slice(0, 10);
  countAlreadySubmitted = false;
  countGroups: CountGroup[] = [];
  countSearch         = '';
  countCategories: CategoryOpt[] = [];
  countLoaded         = false;
  countCategoriesLoaded = false;

  // Top-level quick-add modal
  topAddOpen = false;
  topAdd: { name: string; category_id: number | null; unit_label: string; min_qty: string; saving: boolean } = {
    name: '', category_id: null, unit_label: 'pcs', min_qty: '', saving: false
  };

  /* ─── TAB: STOCK ───────────────────────────────────────── */
  stocks: any[]          = [];
  stockLoading           = false;
  searchTerm             = '';
  stockFilter: StockFilter = 'all';

  /* ─── TAB: PURCHASES ────────────────────────────────────── */
  purchaseView: PurchaseView = 'history';
  showAddForm  = false;

  // Add form — primary field is qty (total in item's unit).
  // Optional pack breakdown: when packs > 1 AND qty_per_pack filled → auto-fills qty.
  dropdown: any[] = [];
  addForm = {
    stock_item_id:  null as number | null,
    purchase_date:  today(),
    supplier:       '',
    qty:            null as number | null,   // total qty to add (required)
    showBreakdown:  false,                   // expand pack breakdown helper
    packs:          null as number | null,   // optional: no. of packs
    qty_per_pack:   null as number | null,   // optional: qty inside each pack
    purchase_price: null as number | null,
    expiry_date:    '',
    batch_no:       '',
    notes:          ''
  };
  addLoading = false;
  addError   = '';

  // History
  purchases: any[]   = [];
  purchasePage       = 1;
  purchaseTotal      = 0;
  purchaseTotalPages = 0;
  purchaseFilterId: number | null = null;
  purchaseSearch     = '';
  editingPurchaseId: number | null = null;
  purchaseEditForm = { expiry_date: '', supplier: '', batch_no: '', notes: '' };

  // Expiry
  expiryList: any[] = [];
  expiryDays = 7;

  /* ─── TAB: MANAGE ────────────────────────────────────────── */
  manageView: ManageView = 'items';

  items: any[]      = [];
  categories: any[] = [];
  itemsLoading      = false;
  itemSearch        = '';
  showNewItemForm   = false;
  newItemForm = {
    name: '', category_id: null as number | null,
    // Single-unit model: base_unit is the only unit. unit_label / unit_value are
    // derived (label = base, value = 1). Pack count is per-purchase, not on the item.
    base_unit: 'pcs', min_qty: 0
  };
  newItemError   = '';
  newItemLoading = false;
  editingItemId: number | null  = null;
  itemEditForm: {
    name: string;
    category_id: number | null;
    base_unit: string;
    unit_label: string;
    unit_value: number;
    min_qty: number;
  } = { name: '', category_id: null, base_unit: 'gm', unit_label: 'kg', unit_value: 1000, min_qty: 0 };

  logs: any[] = [];
  logAction   = '';

  /* ══════════════════════════════════════════════════════════ */

  ngOnInit() {
    this.isAdmin = this.auth.isManagerOrAdmin();
    this.route.queryParams.subscribe(p => {
      const filter = p['filter'];
      const tab    = p['tab'] as Tab | undefined;

      if (filter === 'low')      this.stockFilter = 'low';
      else if (filter === 'out') this.stockFilter = 'out';

      // Filter param implies the Stock Overview tab regardless of role.
      if (tab && this.isTabAllowed(tab)) {
        this.setTab(tab);
      } else if (filter === 'low' || filter === 'out') {
        this.setTab('stock');
      } else {
        this.setTab('count');
      }
    });
  }

  private isTabAllowed(tab: string): tab is Tab {
    if (!['count', 'stock', 'purchases', 'manage'].includes(tab)) return false;
    if ((tab === 'purchases' || tab === 'manage') && !this.isAdmin) return false;
    return true;
  }

  setTab(tab: Tab) {
    if (!this.isTabAllowed(tab)) tab = 'count';
    this.activeTab = tab;
    if (tab === 'count')     { this.loadCountCategories(); if (!this.countLoaded) this.loadCount(); }
    if (tab === 'stock'     && !this.stocks.length)   this.loadStock();
    if (tab === 'purchases') { this.loadDropdown(); this.loadPurchases(1); }
    if (tab === 'manage')   { this.loadItems(); this.loadCategories(); }
  }

  /* ══════════════════════════════════════════════════════════
     STOCK
     ══════════════════════════════════════════════════════════ */
  loadStock() {
    this.stockLoading = true;
    this.stockApi.getStock().subscribe({
      next: rows => {
        this.stocks      = rows.map(r => ({ ...r, _qty: null, _reason: 'DAILY_REFILL' }));
        this.stockLoading = false;
      },
      error: () => { this.stockLoading = false; }
    });
  }

  setStockFilter(f: StockFilter) { this.stockFilter = f; }

  get filteredStocks() {
    let list = this.stocks;
    if (this.stockFilter === 'low')      list = list.filter(s => s.is_low_stock && s.current_qty > 0);
    if (this.stockFilter === 'out')      list = list.filter(s => s.current_qty <= 0);
    if (this.stockFilter === 'expiring') list = list.filter(s => s.nearest_expiry && s.expiring_count > 0);
    if (this.searchTerm.trim())
      list = list.filter(s => s.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
    return list;
  }

  get lowCount()      { return this.stocks.filter(s => s.is_low_stock && s.current_qty > 0).length; }
  get outCount()      { return this.stocks.filter(s => s.current_qty <= 0).length; }
  get expiringCount() { return this.stocks.filter(s => s.nearest_expiry && s.expiring_count > 0).length; }

  updateStock(s: any) {
    const qty = parseFloat(s._qty);
    if (!s._qty || isNaN(qty) || qty <= 0) { alert('Enter a valid quantity greater than 0'); return; }
    const reason: string = s._reason || 'DAILY_REFILL';
    if (!this.isAdmin && reason !== 'DAILY_REFILL') { alert('Not authorised'); return; }
    let change = qty;
    if (reason === 'WASTAGE') change = -qty;
    const currentQty = parseFloat(s.current_qty);
    const newQty     = parseFloat((currentQty + change).toFixed(3));
    if (newQty < 0) { alert('Stock cannot go below zero'); return; }
    if (!confirm(`${reason} — ${s.name}\n${currentQty} → ${newQty} ${s.base_unit}`)) return;
    this.stockApi.adjust({ product_id: s.id, change_qty: change, reason }).subscribe({
      next: () => { s.current_qty = newQty; s._qty = null; },
      error: err => alert(err.error?.message || 'Update failed')
    });
  }

  expiryClass(s: any) {
    if (!s.nearest_expiry) return '';
    const days = Math.floor((new Date(s.nearest_expiry).getTime() - Date.now()) / 86400000);
    if (days < 0)  return 'exp--expired';
    if (days <= 3) return 'exp--today';
    if (days <= 7) return 'exp--soon';
    return 'exp--ok';
  }

  /* ══════════════════════════════════════════════════════════
     PURCHASES TAB
     ══════════════════════════════════════════════════════════ */
  setPurchaseView(v: PurchaseView) {
    this.purchaseView = v;
    if (v === 'expiry') this.loadExpiry();
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (this.showAddForm) this.loadDropdown();
  }

  loadDropdown() {
    this.stockApi.getDropdown().subscribe({ next: rows => this.dropdown = rows });
  }

  get selectedDropdownItem() {
    return this.dropdown.find(d => d.id === Number(this.addForm.stock_item_id));
  }

  /** When pack breakdown is active and both packs + qty_per_pack are filled, auto-update qty. */
  recomputeAddQty() {
    const packs   = Number(this.addForm.packs);
    const perPack = Number(this.addForm.qty_per_pack);
    if (packs > 0 && perPack > 0) {
      this.addForm.qty = Math.round(packs * perPack * 1000) / 1000;
    }
  }

  toggleBreakdown() {
    this.addForm.showBreakdown = !this.addForm.showBreakdown;
    if (!this.addForm.showBreakdown) {
      this.addForm.packs       = null;
      this.addForm.qty_per_pack = null;
    }
  }

  submitAdd() {
    if (!this.addForm.stock_item_id)                                   { this.addError = 'Select a stock item'; return; }
    if (!this.addForm.qty || this.addForm.qty <= 0)                    { this.addError = 'Enter quantity'; return; }
    if (this.addForm.purchase_price == null || this.addForm.purchase_price < 0) { this.addError = 'Enter purchase price'; return; }
    if (this.addForm.showBreakdown) {
      if (!this.addForm.packs || this.addForm.packs <= 0)              { this.addError = 'Enter number of packs'; return; }
      if (!this.addForm.qty_per_pack || this.addForm.qty_per_pack <= 0){ this.addError = 'Enter qty per pack'; return; }
    }
    this.addError   = '';
    this.addLoading = true;

    const packs   = Number(this.addForm.packs   || 0);
    const perPack = Number(this.addForm.qty_per_pack || 0);
    // Append pack-breakdown to notes for traceability (e.g. "2 × 40 packs")
    const breakdown = (this.addForm.showBreakdown && packs > 0 && perPack > 0)
      ? `${packs} × ${perPack} packs`
      : null;
    const baseNotes  = (this.addForm.notes || '').trim();
    const finalNotes = breakdown
      ? (baseNotes ? `${baseNotes} (${breakdown})` : breakdown)
      : (baseNotes || undefined);

    const payload: any = {
      stock_item_id:  this.addForm.stock_item_id,
      purchase_date:  this.addForm.purchase_date || today(),
      supplier:       this.addForm.supplier      || undefined,
      qty:            Number(this.addForm.qty),
      purchase_price: Number(this.addForm.purchase_price),
      expiry_date:    this.addForm.expiry_date   || undefined,
      batch_no:       this.addForm.batch_no      || undefined,
      notes:          finalNotes
    };
    this.stockApi.addEntry(payload).subscribe({
      next: (res: any) => {
        this.addLoading  = false;
        this.showAddForm = false;
        this.resetAddForm();
        this.stocks = [];
        this.loadPurchases(1);
        this.toast.success(`${res.item}: +${res.qty_added} → ${res.new_total} ${res.base_unit} total`);
      },
      error: err => { this.addLoading = false; this.addError = err.error?.message || 'Failed to save'; }
    });
  }

  resetAddForm() {
    this.addForm = {
      stock_item_id: null, purchase_date: today(), supplier: '',
      qty: null, showBreakdown: false, packs: null, qty_per_pack: null,
      purchase_price: null, expiry_date: '', batch_no: '', notes: ''
    };
    this.addError = '';
  }

  loadPurchases(page = 1) {
    this.purchasePage = page;
    this.stockApi.getEntries({
      page,
      limit:         20,
      stock_item_id: this.purchaseFilterId ?? undefined,
      search:        this.purchaseSearch.trim() || undefined
    }).subscribe({
      next: res => {
        this.purchases          = res.data;
        this.purchaseTotal      = res.total;
        this.purchaseTotalPages = res.totalPages;
      }
    });
  }

  onPurchaseFilterChange() { this.editingPurchaseId = null; this.loadPurchases(1); }
  onPurchaseSearch()       { this.editingPurchaseId = null; this.loadPurchases(1); }

  deletePurchase(e: any) {
    const label = `${e.item_name} — ${e.qty} ${e.unit} (${this.fmtDate(e.purchase_date)})`;
    if (!confirm(`Delete purchase entry?\n${label}\n\nThis will reverse ${e.remaining_qty} ${e.base_unit} from stock.`)) return;
    this.stockApi.deleteEntry(e.id).subscribe({
      next: (res: any) => {
        this.purchases = this.purchases.filter(p => p.id !== e.id);
        this.purchaseTotal = Math.max(0, this.purchaseTotal - 1);
        this.stocks = [];
        this.toast.success(`Deleted — reversed ${res.reversed_qty} ${e.base_unit} from stock`);
      },
      error: err => this.toast.error(err.error?.message || 'Delete failed')
    });
  }

  startEditPurchase(e: any) {
    this.editingPurchaseId = e.id;
    this.purchaseEditForm  = {
      expiry_date: e.expiry_date ? e.expiry_date.substring(0, 10) : '',
      supplier:    e.supplier  || '',
      batch_no:    e.batch_no  || '',
      notes:       e.notes     || ''
    };
  }

  cancelEditPurchase() { this.editingPurchaseId = null; }

  savePurchase(e: any) {
    this.stockApi.updateEntry(e.id, this.purchaseEditForm).subscribe({
      next: res => {
        e.expiry_date = res.entry.expiry_date; e.supplier = res.entry.supplier;
        e.batch_no    = res.entry.batch_no;   e.notes    = res.entry.notes;
        e.expiry_status = res.entry.expiry_status;
        this.editingPurchaseId = null;
        this.stocks = [];
      },
      error: err => alert(err.error?.message || 'Save failed')
    });
  }

  loadExpiry() {
    this.stockApi.getExpiring(this.expiryDays).subscribe({ next: rows => this.expiryList = rows });
  }

  expiryStatusClass(status: string) {
    return ({ EXPIRED:'es--expired', EXPIRING_TODAY:'es--today', EXPIRING_SOON:'es--soon', OK:'es--ok', NO_EXPIRY:'es--none' } as any)[status] || '';
  }

  expiryStatusLabel(status: string) {
    return ({ EXPIRED:'Expired', EXPIRING_TODAY:'Expiring today', EXPIRING_SOON:'Expiring soon', OK:'Good', NO_EXPIRY:'No expiry' } as any)[status] || status;
  }

  /* ══════════════════════════════════════════════════════════
     MANAGE TAB
     ══════════════════════════════════════════════════════════ */
  setManageView(v: ManageView) {
    this.manageView = v;
    if (v === 'logs') this.loadLogs();
  }

  loadItems() {
    this.itemsLoading = true;
    this.stockApi.getStockItemsList({ limit: 200, search: this.itemSearch || undefined }).subscribe({
      next: res  => { this.items = res.data; this.itemsLoading = false; },
      error: ()  => { this.itemsLoading = false; }
    });
  }

  searchItems() { this.loadItems(); }

  loadCategories() {
    if (this.categories.length) return;
    this.stockApi.getStockCategories().subscribe({
      next: res => {
        this.categories = res.data || res;
        // Auto-select 'Stock Items' category as default for new ingredients
        if (!this.newItemForm.category_id && this.categories.length) {
          const stockItemsCat = this.categories.find((c: any) =>
            c.name.toLowerCase() === 'stock items'
          );
          this.newItemForm.category_id = stockItemsCat?.id ?? this.categories[0].id;
        }
      }
    });
  }

  submitNewItem() {
    if (!this.newItemForm.name?.trim() || !this.newItemForm.base_unit?.trim()) {
      this.newItemError = 'Name and unit are required'; return;
    }
    this.newItemError = ''; this.newItemLoading = true;
    // Force unit_label = base_unit and unit_value = 1 — pack count is captured
    // per-purchase, never on the stock item itself.
    const payload = {
      name:        this.newItemForm.name.trim(),
      category_id: this.newItemForm.category_id,
      base_unit:   this.newItemForm.base_unit,
      unit_label:  this.newItemForm.base_unit,
      unit_value:  1,
      min_qty:     Number(this.newItemForm.min_qty) || 0
    };
    this.stockApi.createStockItem(payload).subscribe({
      next: () => {
        this.newItemLoading = false; this.showNewItemForm = false;
        this.newItemForm = { name: '', category_id: null, base_unit: 'pcs', min_qty: 0 };
        this.dropdown = [];
        this.loadItems();
      },
      error: err => { this.newItemLoading = false; this.newItemError = err.error?.msg || 'Create failed'; }
    });
  }

  startEditItem(item: any) {
    this.editingItemId = item.id;
    this.itemEditForm  = {
      name:        item.name || '',
      category_id: item.category_id != null ? Number(item.category_id) : null,
      // Simplified model: one Unit. unit_label and unit_value are forced
      // (unit_label = base_unit, unit_value = 1) so per-purchase "packs × qty/pack"
      // is the only place pack count lives. This removes the double-conversion bug.
      base_unit:   item.base_unit  || 'pcs',
      unit_label:  item.base_unit  || 'pcs',
      unit_value:  1,
      min_qty:     Number(item.min_qty) || 0
    };
  }

  cancelEditItem() { this.editingItemId = null; }

  saveItem(item: any) {
    if (!this.itemEditForm.name?.trim())          { alert('Name is required'); return; }
    if (!this.itemEditForm.base_unit?.trim())     { alert('Unit is required'); return; }
    // Always sync unit_label to base_unit; pack-count is per-purchase, never on the item.
    const payload = {
      name:        this.itemEditForm.name.trim(),
      category_id: this.itemEditForm.category_id,
      base_unit:   this.itemEditForm.base_unit,
      unit_label:  this.itemEditForm.base_unit,
      unit_value:  1,
      min_qty:     Number(this.itemEditForm.min_qty) || 0
    };
    this.stockApi.updateStockItem(item.id, payload).subscribe({
      next: () => {
        item.name         = payload.name;
        item.category_id  = payload.category_id;
        item.category_name = this.categories.find(c => c.id === Number(payload.category_id))?.name || item.category_name;
        item.base_unit    = payload.base_unit;
        item.unit_label   = payload.unit_label;
        item.unit_value   = payload.unit_value;
        item.min_qty      = payload.min_qty;
        this.editingItemId = null;
      },
      error: err => alert(err.error?.msg || 'Update failed')
    });
  }

  toggleItem(item: any) {
    this.stockApi.toggleStockItem(item.id).subscribe({
      next: res => item.is_active = res.is_active,
      error: err => alert(err.error?.msg || 'Toggle failed')
    });
  }

  deleteItem(item: any) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    this.stockApi.deleteStockItem(item.id).subscribe({
      next: () => { this.items = this.items.filter(i => i.id !== item.id); },
      error: err => alert(err.error?.msg || 'Delete failed')
    });
  }

  loadLogs() {
    this.stockApi.getLogs({ limit: 100, action: this.logAction || undefined })
      .subscribe({ next: rows => this.logs = rows });
  }

  logActionClass(action: string) {
    return ({ STOCK_IN:'la--in', DAILY_REFILL:'la--in', USAGE:'la--usage',
              USAGE_RESERVED:'la--usage', WASTAGE:'la--waste', ADJUSTMENT:'la--adj', RETURN:'la--return' } as any)[action] || '';
  }

  logActionLabel(action: string) {
    return ({ STOCK_IN:'Stock In', DAILY_REFILL:'Refill', USAGE:'Used',
              USAGE_RESERVED:'Reserved', WASTAGE:'Wastage', ADJUSTMENT:'Adjustment', RETURN:'Returned' } as any)[action] || action;
  }

  /* ══════════════════════════════════════════════════════════
     DAILY COUNT TAB
     ══════════════════════════════════════════════════════════ */
  private loadCountCategories() {
    if (this.countCategoriesLoaded) return;
    // Daily Count quick-add only creates stock items, so use the stock-only list.
    this.stockApi.getStockCategories().subscribe({
      next: (res: any) => {
        this.countCategories = res?.data || res || [];
        this.countCategoriesLoaded = true;
      },
      error: () => {}
    });
  }

  loadCount() {
    this.countLoading = true;
    this.stockApi.getCountToday(this.countDate).subscribe({
      next: (res: any) => {
        this.countAlreadySubmitted = res.already_submitted;
        this.countGroups = (res.groups || []).map((g: any) => ({
          name: g.name,
          category_id: g.category_id ?? null,
          items: (g.items || []).map((it: any) => this.toCountRow(it)),
          addOpen: false,
          addForm: { name: '', unit_label: 'pcs', min_qty: '', saving: false }
        }));
        this.countLoading = false;
        this.countLoaded  = true;
      },
      error: () => { this.countLoading = false; this.toast.error('Failed to load'); }
    });
  }

  private toCountRow(it: any): CountRow {
    const opening = Number(it.opening_qty || 0);
    const expectedClosing = it.expected_closing != null ? Number(it.expected_closing) : null;
    const hasSavedClosing = it.closing_qty != null;

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

  changeCountDate() { this.loadCount(); }

  private get countSearchTerm(): string {
    return (this.countSearch || '').toLowerCase().trim();
  }

  visibleItemsFor(g: CountGroup): CountRow[] {
    const s = this.countSearchTerm;
    if (!s) return g.items;
    if (g.name.toLowerCase().includes(s)) return g.items;
    return g.items.filter(r => r.name.toLowerCase().includes(s));
  }

  shouldShowCountGroup(g: CountGroup): boolean {
    if (!this.countSearchTerm) return true;
    if (g.addOpen) return true;
    return this.visibleItemsFor(g).length > 0;
  }

  hasAnyCountResults(): boolean {
    return this.countGroups.some(g => this.shouldShowCountGroup(g));
  }

  clearCountSearch() { this.countSearch = ''; }

  markCountDirty(r: CountRow) { r.dirty = true; }

  computeVariance(r: CountRow): number | null {
    if (r.closing_input === '' || isNaN(Number(r.closing_input))) return null;
    const opening  = Number(r.opening_input || r.opening_qty || 0);
    const purchase = Number(r.purchase_input || 0);
    const expected = opening + purchase;
    return Number(r.closing_input) - expected;
  }

  fillSame(r: CountRow) {
    const opening  = Number(r.opening_input || r.opening_qty || 0);
    const purchase = Number(r.purchase_input || 0);
    r.closing_input = String(opening + purchase);
    r.dirty = true;
  }

  fillAll() {
    for (const g of this.countGroups)
      for (const r of g.items)
        if (!r.locked || this.isAdmin) this.fillSame(r);
  }

  get totalDirty(): number {
    let n = 0;
    for (const g of this.countGroups) for (const r of g.items) if (r.dirty) n++;
    return n;
  }

  saveAllCount() {
    const items: any[] = [];
    for (const g of this.countGroups) {
      for (const r of g.items) {
        if (!r.dirty) continue;
        if (r.locked && !this.isAdmin) continue;
        if (r.closing_input === '' || isNaN(Number(r.closing_input))) continue;
        const purchase = r.purchase_input === '' ? 0 : Number(r.purchase_input);
        items.push({
          stock_item_id: r.stock_item_id,
          closing_qty:   Number(r.closing_input),
          purchase_qty:  purchase > 0 ? purchase : 0,
          opening_qty:   this.isAdmin && r.opening_input !== '' ? Number(r.opening_input) : undefined,
          note:          r.note_input?.trim() || undefined
        });
      }
    }
    if (!items.length) {
      this.toast.error('Nothing to save — enter at least one closing count');
      return;
    }
    this.countSaving = true;
    const payload: any = { items };
    if (this.isAdmin) payload.count_date = this.countDate;
    this.stockApi.saveCount(payload).subscribe({
      next: () => {
        this.toast.success(`Saved ${items.length} item(s)`);
        this.countSaving = false;
        this.loadCount();
      },
      error: (err) => {
        this.countSaving = false;
        this.toast.error(err?.error?.message || 'Save failed');
      }
    });
  }

  updateMinQty(r: CountRow) {
    const val = Number(r.min_qty_input);
    if (isNaN(val) || val < 0) return;
    this.stockApi.updateStockItem(r.stock_item_id, { min_qty: val }).subscribe({
      next: () => this.toast.success(`Min stock updated for ${r.name}`),
      error: () => this.toast.error('Failed to update min stock')
    });
  }

  unlockRow(id: number) {
    if (!confirm('Unlock this row so it can be edited?')) return;
    this.stockApi.unlockCountRow(id).subscribe({
      next: () => { this.toast.success('Unlocked'); this.loadCount(); }
    });
  }

  /* ── Top-level + New Item modal ── */
  openTopAdd() {
    this.topAdd = {
      name: '',
      category_id: this.countCategories[0]?.id || null,
      unit_label: 'pcs',
      min_qty: '',
      saving: false
    };
    this.topAddOpen = true;
  }
  closeTopAdd() { this.topAddOpen = false; }

  saveTopAdd() {
    if (!this.topAdd.name.trim()) { this.toast.error('Name required'); return; }
    this.topAdd.saving = true;
    this.stockApi.quickAddStockItem({
      name:        this.topAdd.name.trim(),
      category_id: this.topAdd.category_id,
      unit_label:  this.topAdd.unit_label || 'pcs',
      base_unit:   this.topAdd.unit_label || 'pcs',
      unit_value:  1,
      min_qty:     this.topAdd.min_qty ? Number(this.topAdd.min_qty) : 0
    }).subscribe({
      next: () => {
        this.toast.success('Item added');
        this.topAddOpen = false;
        this.topAdd.saving = false;
        this.loadCount();
      },
      error: (err) => {
        this.topAdd.saving = false;
        this.toast.error(err?.error?.message || 'Failed to add');
      }
    });
  }

  /* ── Inline add new item (per group) ── */
  toggleAddInGroup(g: CountGroup) {
    g.addOpen = !g.addOpen;
    if (g.addOpen) g.addForm = { name: '', unit_label: 'pcs', min_qty: '', saving: false };
  }

  saveNewItemInGroup(g: CountGroup) {
    if (!g.addForm) return;
    const f = g.addForm;
    if (!f.name.trim()) { this.toast.error('Name required'); return; }
    f.saving = true;
    this.stockApi.quickAddStockItem({
      name:        f.name.trim(),
      category_id: g.category_id ?? null,
      unit_label:  f.unit_label || 'pcs',
      base_unit:   f.unit_label || 'pcs',
      unit_value:  1,
      min_qty:     f.min_qty ? Number(f.min_qty) : 0
    }).subscribe({
      next: () => {
        this.toast.success('Item added');
        f.saving = false;
        g.addOpen = false;
        this.loadCount();
      },
      error: (err) => {
        f.saving = false;
        this.toast.error(err?.error?.message || 'Failed to add');
      }
    });
  }

  /* ══════════════════════════════════════════════════════════ */
  fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  pageRange(n: number) { return Array.from({ length: n }, (_, i) => i + 1); }
}

function today() { return new Date().toISOString().split('T')[0]; }
