import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthApi } from '../../core/api/auth.api';
import { StockApi } from '../../core/api/stock.api';
import { StockItem, StockEntry, StockLog, BatchEntry } from '../../core/models/stock.model';

type Tab = 'stock' | 'add' | 'entries' | 'expiring' | 'logs' | 'items';

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

  isAdmin    = false;
  activeTab: Tab = 'stock';
  loading    = false;

  /* ── STOCK LIST ─────────────────────────── */
  stocks: StockItem[] = [];
  searchTerm  = '';
  filterType: 'low' | 'out' | null = null;

  /* ── ADD STOCK FORM ─────────────────────── */
  dropdown: any[]  = [];
  form = {
    stock_item_id: null as number | null,
    purchase_date: new Date().toISOString().split('T')[0],
    supplier: ''
  };
  batches: BatchEntry[] = [this.newBatch()];
  addLoading = false;
  addError   = '';

  /* ── PURCHASE HISTORY ───────────────────── */
  entries: StockEntry[]  = [];
  entryPage       = 1;
  entryTotal      = 0;
  entryTotalPages = 0;
  entryFilterItemId: number | null = null;
  editingEntryId: number | null = null;
  entryEditForm = { expiry_date: '', batch_no: '', supplier: '', notes: '' };

  /* ── EXPIRY ALERTS ──────────────────────── */
  expiringList: any[] = [];
  expiryDays = 7;

  /* ── STOCK LOGS ─────────────────────────── */
  logs: StockLog[] = [];
  logAction = '';

  /* ── ITEMS MANAGEMENT ───────────────────── */
  items: any[] = [];
  categories: any[] = [];
  itemsLoading  = false;
  editingId: number | null = null;
  editForm = { name: '', category_id: null as number | null, min_qty: 0 };
  showAddForm   = false;
  addItemForm   = { name: '', category_id: null as number | null, base_unit: 'gm', unit_label: 'kg', unit_value: 1000, min_qty: 0 };
  addItemError  = '';
  addItemLoading = false;

  /* ════════════════════════════════════════ */
  ngOnInit() {
    this.isAdmin = this.auth.isAdmin();
    this.route.queryParams.subscribe(p => {
      this.filterType = p['filter'] || null;
      this.loadStock();
    });
  }

  /* ── TAB SWITCH ─────────────────────────── */
  setTab(tab: Tab) {
    const adminOnly: Tab[] = ['add', 'entries', 'logs', 'items'];
    if (adminOnly.includes(tab) && !this.isAdmin) return;
    this.activeTab = tab;
    if (tab === 'stock'    && !this.stocks.length)   this.loadStock();
    if (tab === 'add'      && !this.dropdown.length) this.loadDropdown();
    if (tab === 'entries') { this.loadDropdown(); this.loadEntries(1); }
    if (tab === 'expiring')                          this.loadExpiring();
    if (tab === 'logs')                              this.loadLogs();
    if (tab === 'items')  { this.loadItems(); this.loadCategories(); }
  }

  /* ════════════════════════════════════════
     STOCK LIST
     ════════════════════════════════════════ */
  loadStock() {
    this.loading = true;
    this.stockApi.getStock().subscribe({
      next: res => {
        this.stocks  = res.map(p => ({ ...p, change_qty: null, reason: 'DAILY_REFILL' }));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  get filteredStocks() {
    let list = this.stocks;
    if (this.filterType === 'low') list = list.filter(p => p.is_low_stock && p.current_qty > 0);
    if (this.filterType === 'out') list = list.filter(p => p.current_qty <= 0);
    if (this.searchTerm)
      list = list.filter(p => p.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
    return list;
  }

  updateStock(p: StockItem) {
    if (!p.change_qty) { alert('Enter quantity'); return; }
    if (!this.isAdmin && p.reason !== 'DAILY_REFILL') {
      alert('You are not authorized to perform this action'); return;
    }
    let qty = Number(p.change_qty);
    if (p.reason === 'DAILY_REFILL') qty =  Math.abs(qty);
    if (p.reason === 'WASTAGE')      qty = -Math.abs(qty);
    const newQty = p.current_qty + qty;
    if (newQty < 0) { alert('Stock cannot go below zero'); return; }
    if (!confirm(`${p.reason} — ${p.name}\nFrom ${p.current_qty} → ${newQty}`)) return;

    this.stockApi.adjust({ product_id: p.id, change_qty: qty, reason: p.reason! }).subscribe({
      next: () => { p.current_qty = newQty; p.change_qty = null; },
      error: err => alert(err.error?.message || 'Update failed')
    });
  }

  expiryBadgeClass(item: StockItem) {
    if (!item.nearest_expiry) return '';
    const days = Math.floor(
      (new Date(item.nearest_expiry).getTime() - Date.now()) / 86400000
    );
    if (days < 0)  return 'exp--expired';
    if (days <= 3) return 'exp--today';
    if (days <= 7) return 'exp--soon';
    return 'exp--ok';
  }

  formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ════════════════════════════════════════
     ADD STOCK — MULTI-BATCH FORM
     ════════════════════════════════════════ */
  loadDropdown() {
    this.stockApi.getDropdown().subscribe(res => this.dropdown = res);
  }

  newBatch(): BatchEntry {
    return { qty: null, purchase_price: null, expiry_date: '', batch_no: '', notes: '' };
  }

  addBatchRow() {
    this.batches.push(this.newBatch());
  }

  removeBatchRow(i: number) {
    if (this.batches.length > 1) this.batches.splice(i, 1);
  }

  get totalQty() {
    return this.batches.reduce((s, b) => s + (Number(b.qty) || 0), 0);
  }

  get selectedItem() {
    return this.dropdown.find(d => d.id === Number(this.form.stock_item_id));
  }

  submitAdd() {
    if (!this.form.stock_item_id) { this.addError = 'Select a stock item'; return; }
    if (this.batches.some(b => !b.qty || b.purchase_price == null)) {
      this.addError = 'Every batch must have qty and price'; return;
    }
    this.addError   = '';
    this.addLoading = true;

    const entries = this.batches.map(b => ({
      qty:            Number(b.qty),
      purchase_price: Number(b.purchase_price),
      expiry_date:    b.expiry_date || undefined,
      batch_no:       b.batch_no   || undefined,
      notes:          b.notes      || undefined
    }));

    const payload = {
      stock_item_id: this.form.stock_item_id,
      purchase_date: this.form.purchase_date,
      supplier:      this.form.supplier || undefined,
      entries
    };

    // single batch → /stock/add  |  multiple batches → /stock/add-bulk
    const api$ = entries.length === 1
      ? this.stockApi.addEntry({ ...payload, ...entries[0] })
      : this.stockApi.addBulk(payload);

    api$.subscribe({
      next: (res: any) => {
        this.addLoading = false;
        const qty = res.total_base_qty ?? res.base_qty;
        alert(`Stock added!\n${res.item} — ${qty} ${res.base_unit}\nNew total: ${res.new_total}`);
        this.resetForm();
        this.stocks = [];       // force reload when switching back
        this.setTab('stock');
      },
      error: err => {
        this.addLoading = false;
        this.addError   = err.error?.message || 'Failed to add stock';
      }
    });
  }

  resetForm() {
    this.form    = { stock_item_id: null, purchase_date: new Date().toISOString().split('T')[0], supplier: '' };
    this.batches = [this.newBatch()];
    this.addError = '';
  }

  /* ════════════════════════════════════════
     PURCHASE HISTORY
     ════════════════════════════════════════ */
  loadEntries(page = 1) {
    this.entryPage = page;
    this.stockApi.getEntries({
      page,
      limit: 20,
      stock_item_id: this.entryFilterItemId ?? undefined
    }).subscribe({
      next: res => {
        this.entries         = res.data;
        this.entryTotal      = res.total;
        this.entryTotalPages = res.totalPages;
      }
    });
  }

  onEntryFilterChange() {
    this.editingEntryId = null;
    this.loadEntries(1);
  }

  startEntryEdit(e: any) {
    this.editingEntryId = e.id;
    this.entryEditForm  = {
      expiry_date: e.expiry_date ? e.expiry_date.split('T')[0] : '',
      batch_no:    e.batch_no   || '',
      supplier:    e.supplier   || '',
      notes:       e.notes      || ''
    };
  }

  cancelEntryEdit() { this.editingEntryId = null; }

  saveEntry(e: any) {
    this.stockApi.updateEntry(e.id, this.entryEditForm).subscribe({
      next: res => {
        e.expiry_date   = res.entry.expiry_date;
        e.batch_no      = res.entry.batch_no;
        e.supplier      = res.entry.supplier;
        e.notes         = res.entry.notes;
        e.expiry_status = res.entry.expiry_status;
        this.editingEntryId = null;
        // refresh stock list so nearest_expiry badge updates there too
        this.stocks = [];
      },
      error: err => alert(err.error?.message || 'Update failed')
    });
  }

  entryStatusClass(status: string) {
    const map: Record<string, string> = {
      EXPIRED:        'es--expired',
      EXPIRING_TODAY: 'es--today',
      EXPIRING_SOON:  'es--soon',
      OK:             'es--ok',
      NO_EXPIRY:      'es--none'
    };
    return map[status] || '';
  }

  entryStatusLabel(status: string) {
    const map: Record<string, string> = {
      EXPIRED:        'Expired',
      EXPIRING_TODAY: 'Expiring today',
      EXPIRING_SOON:  'Expiring soon',
      OK:             'Good',
      NO_EXPIRY:      'No expiry'
    };
    return map[status] || status;
  }

  /* ════════════════════════════════════════
     EXPIRY ALERTS
     ════════════════════════════════════════ */
  loadExpiring() {
    this.stockApi.getExpiring(this.expiryDays).subscribe({
      next: res => this.expiringList = res
    });
  }

  /* ════════════════════════════════════════
     STOCK LOGS
     ════════════════════════════════════════ */
  loadLogs() {
    this.stockApi.getLogs({
      limit: 100,
      action: this.logAction || undefined
    }).subscribe({ next: res => this.logs = res });
  }

  logActionClass(action: string) {
    const map: Record<string, string> = {
      STOCK_IN:     'la--in',
      USAGE:        'la--usage',
      WASTAGE:      'la--waste',
      ADJUSTMENT:   'la--adj',
      RETURN:       'la--return',
      DAILY_REFILL: 'la--in'
    };
    return map[action] || '';
  }

  pages(total: number) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  /* ════════════════════════════════════════
     ITEMS MANAGEMENT
     ════════════════════════════════════════ */
  loadItems() {
    this.itemsLoading = true;
    this.stockApi.getStockItemsList({ limit: 200 }).subscribe({
      next: res => { this.items = res.data; this.itemsLoading = false; },
      error: ()  => { this.itemsLoading = false; }
    });
  }

  loadCategories() {
    if (this.categories.length) return;
    this.stockApi.getCategories().subscribe({
      next: res => { this.categories = res.data || res; }
    });
  }

  startEdit(item: any) {
    this.editingId = item.id;
    this.editForm  = { name: item.name, category_id: item.category_id, min_qty: item.min_qty };
  }

  cancelEdit() { this.editingId = null; }

  saveItem(item: any) {
    this.stockApi.updateStockItem(item.id, this.editForm).subscribe({
      next: () => {
        item.name        = this.editForm.name;
        item.category_id = this.editForm.category_id;
        item.min_qty     = this.editForm.min_qty;
        item.category_name = this.categories.find(c => c.id === Number(this.editForm.category_id))?.name || item.category_name;
        this.editingId   = null;
      },
      error: err => alert(err.error?.msg || 'Update failed')
    });
  }

  toggleItem(item: any) {
    this.stockApi.toggleStockItem(item.id).subscribe({
      next: res => { item.is_active = res.is_active; },
      error: err => alert(err.error?.msg || 'Toggle failed')
    });
  }

  submitAddItem() {
    if (!this.addItemForm.name || !this.addItemForm.base_unit || !this.addItemForm.unit_label) {
      this.addItemError = 'Name, base unit and unit label are required'; return;
    }
    this.addItemError   = '';
    this.addItemLoading = true;
    this.stockApi.createStockItem(this.addItemForm).subscribe({
      next: () => {
        this.addItemLoading = false;
        this.showAddForm    = false;
        this.addItemForm    = { name: '', category_id: null, base_unit: 'gm', unit_label: 'kg', unit_value: 1000, min_qty: 0 };
        this.loadItems();
      },
      error: err => {
        this.addItemLoading = false;
        this.addItemError   = err.error?.msg || 'Failed to create item';
      }
    });
  }
}
