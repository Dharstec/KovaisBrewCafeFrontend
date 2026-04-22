import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthApi } from '../../core/api/auth.api';
import { StockApi } from '../../core/api/stock.api';

type Tab = 'stock' | 'purchases' | 'manage';
type StockFilter = 'all' | 'low' | 'out' | 'expiring';
type PurchaseView = 'history' | 'expiry';
type ManageView = 'items' | 'logs';

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

  isAdmin   = false;
  activeTab: Tab = 'stock';

  /* ─── TAB: STOCK ───────────────────────────────────────── */
  stocks: any[]          = [];
  stockLoading           = false;
  searchTerm             = '';
  stockFilter: StockFilter = 'all';

  /* ─── TAB: PURCHASES ────────────────────────────────────── */
  purchaseView: PurchaseView = 'history';
  showAddForm  = false;

  // Add form
  dropdown: any[] = [];
  addForm = {
    stock_item_id: null as number | null,
    purchase_date: today(),
    supplier: '',
    qty:            null as number | null,
    purchase_price: null as number | null,
    expiry_date: '',
    batch_no: '',
    notes: ''
  };
  addLoading = false;
  addError   = '';

  // History
  purchases: any[]   = [];
  purchasePage       = 1;
  purchaseTotal      = 0;
  purchaseTotalPages = 0;
  purchaseFilterId: number | null = null;
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
    base_unit: 'gm', unit_label: 'kg', unit_value: 1000, min_qty: 0
  };
  newItemError   = '';
  newItemLoading = false;
  editingItemId: number | null  = null;
  itemEditForm = { name: '', category_id: null as number | null, min_qty: 0 };

  logs: any[] = [];
  logAction   = '';

  /* ══════════════════════════════════════════════════════════ */

  ngOnInit() {
    this.isAdmin = this.auth.isAdmin();
    this.route.queryParams.subscribe(p => {
      if (p['filter'] === 'low')  this.stockFilter = 'low';
      if (p['filter'] === 'out')  this.stockFilter = 'out';
      this.loadStock();
    });
  }

  setTab(tab: Tab) {
    this.activeTab = tab;
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
    if (this.dropdown.length) return;
    this.stockApi.getDropdown().subscribe({ next: rows => this.dropdown = rows });
  }

  get selectedDropdownItem() {
    return this.dropdown.find(d => d.id === Number(this.addForm.stock_item_id));
  }

  submitAdd() {
    if (!this.addForm.stock_item_id)                                   { this.addError = 'Select a stock item'; return; }
    if (!this.addForm.qty || this.addForm.qty <= 0)                    { this.addError = 'Enter quantity'; return; }
    if (this.addForm.purchase_price == null || this.addForm.purchase_price < 0) { this.addError = 'Enter purchase price'; return; }
    this.addError   = '';
    this.addLoading = true;
    const payload: any = {
      stock_item_id:  this.addForm.stock_item_id,
      purchase_date:  this.addForm.purchase_date || today(),
      supplier:       this.addForm.supplier      || undefined,
      qty:            Number(this.addForm.qty),
      purchase_price: Number(this.addForm.purchase_price),
      expiry_date:    this.addForm.expiry_date   || undefined,
      batch_no:       this.addForm.batch_no      || undefined,
      notes:          this.addForm.notes         || undefined
    };
    this.stockApi.addEntry(payload).subscribe({
      next: (res: any) => {
        this.addLoading  = false;
        this.showAddForm = false;
        this.resetAddForm();
        this.stocks = [];
        this.loadPurchases(1);
        alert(`Saved! ${res.item}  +${res.qty_added}  →  ${res.new_total} ${res.base_unit} total`);
      },
      error: err => { this.addLoading = false; this.addError = err.error?.message || 'Failed to save'; }
    });
  }

  resetAddForm() {
    this.addForm = {
      stock_item_id: null, purchase_date: today(), supplier: '',
      qty: null, purchase_price: null, expiry_date: '', batch_no: '', notes: ''
    };
    this.addError = '';
  }

  loadPurchases(page = 1) {
    this.purchasePage = page;
    this.stockApi.getEntries({ page, limit: 20, stock_item_id: this.purchaseFilterId ?? undefined }).subscribe({
      next: res => {
        this.purchases          = res.data;
        this.purchaseTotal      = res.total;
        this.purchaseTotalPages = res.totalPages;
      }
    });
  }

  onPurchaseFilterChange() { this.editingPurchaseId = null; this.loadPurchases(1); }

  startEditPurchase(e: any) {
    this.editingPurchaseId = e.id;
    this.purchaseEditForm  = {
      expiry_date: e.expiry_date ? e.expiry_date.substring(0, 10) : '',
      supplier: e.supplier || '', batch_no: e.batch_no || '', notes: e.notes || ''
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
    this.stockApi.getCategories().subscribe({ next: res => this.categories = res.data || res });
  }

  submitNewItem() {
    if (!this.newItemForm.name || !this.newItemForm.base_unit || !this.newItemForm.unit_label) {
      this.newItemError = 'Name, base unit and purchase unit are required'; return;
    }
    this.newItemError = ''; this.newItemLoading = true;
    this.stockApi.createStockItem(this.newItemForm).subscribe({
      next: () => {
        this.newItemLoading = false; this.showNewItemForm = false;
        this.newItemForm = { name: '', category_id: null, base_unit: 'gm', unit_label: 'kg', unit_value: 1000, min_qty: 0 };
        this.dropdown = [];
        this.loadItems();
      },
      error: err => { this.newItemLoading = false; this.newItemError = err.error?.msg || 'Create failed'; }
    });
  }

  startEditItem(item: any) {
    this.editingItemId = item.id;
    this.itemEditForm  = { name: item.name, category_id: item.category_id, min_qty: item.min_qty };
  }

  cancelEditItem() { this.editingItemId = null; }

  saveItem(item: any) {
    this.stockApi.updateStockItem(item.id, this.itemEditForm).subscribe({
      next: () => {
        item.name        = this.itemEditForm.name;
        item.min_qty     = this.itemEditForm.min_qty;
        item.category_id = this.itemEditForm.category_id;
        item.category_name = this.categories.find(c => c.id === Number(this.itemEditForm.category_id))?.name || item.category_name;
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

  /* ══════════════════════════════════════════════════════════ */
  fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  pageRange(n: number) { return Array.from({ length: n }, (_, i) => i + 1); }
}

function today() { return new Date().toISOString().split('T')[0]; }
