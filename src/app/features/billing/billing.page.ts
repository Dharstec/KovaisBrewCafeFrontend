import { Component, inject, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs'; // used by preflightStockOk

import { BillingStore }      from '../../core/state/billing.store';
import { ProductApi }        from '../../core/api/product.api';
import { BillApi, StockShortfallEntry } from '../../core/api/bill.api';
import { PrinterService }    from '../../core/services/printer.service';
import { SettingsApi }       from '../../core/api/settings.api';
import { AuthApi }           from '../../core/api/auth.api';

@Component({
  standalone: true,
  selector: 'app-billing-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss']
})
export class BillingPage implements OnInit {

  /* ── deps ── */
  store      = inject(BillingStore);
  productApi = inject(ProductApi);
  billApi    = inject(BillApi);
  printer    = inject(PrinterService);
  settingsApi = inject(SettingsApi);
  authApi    = inject(AuthApi);

  /* ── catalogue ── */
  products         : any[]   = [];
  categories       : any[]   = [];
  selectedCategory           = 'All';
  searchText                 = '';
  platform                   = '';

  /* ── order ── */
  cart             : any[]   = [];
  customerName               = '';
  paymentMethod              = '';

  /* ── coupon ── */
  couponCode     = '';
  couponDiscount = 0;
  couponApplied  = false;

  /* ── ui state ── */
  errorMsg       = '';
  successMsg     = '';
  isSaving       = false;
  isCompleting   = false;
  showCart       = false;

  /* ── packing charges ── */
  packingDefaults = { zomato: 0, swiggy: 0 };

  /* ── admin: backdated billing ── */
  isAdmin  = false;
  billDate = '';
  todayStr = new Date().toISOString().split('T')[0];

  /* ── add-on selection popup ── */
  addonModal: {
    product: any;
    addons:  any[];
    selected: Set<number>;
    loading: boolean;
  } | null = null;

  /* ── ingredient popup ── */
  ingredientModal: { product: any; items: any[]; loading: boolean } | null = null;

  /* ── out-of-stock pre-flight ── */
  outOfStockModal: { items: StockShortfallEntry[] } | null = null;
  isChecking = false;

  /* ── split payment ── */
  splitPayment = false;
  splitCash    = 0;
  splitUpi     = 0;

  get splitTotal(): number { return +(this.splitCash + this.splitUpi).toFixed(2); }
  get splitValid(): boolean { return Math.abs(this.splitTotal - this.finalTotal) < 0.01; }

  /* ── keyboard shortcuts ── */
  showShortcutsHelp = false;
  shortcutBuffer    = '';
  private shortcutTimer: any = null;
  @ViewChild('searchInput') searchInputEl!: ElementRef<HTMLInputElement>;

  /* ════════════════════════════════
     COMPUTED
  ════════════════════════════════ */
  get subtotal(): number {
    return this.store.getTotal();
  }

  /* Zomato tiered packing rate by unit price */
  private zomatoPackingRate(price: number): number {
    if (price < 50)   return 5;
    if (price < 150)  return 7;
    if (price < 350)  return 10;
    if (price < 500)  return 15;
    if (price < 1000) return 20;
    return 25;
  }

  /* Swiggy tiered packing rate by unit price */
  private swiggyPackingRate(price: number): number {
    if (price < 50)  return 5;
    if (price < 150) return 7;
    if (price < 300) return 10;
    if (price < 500) return 15;
    return 20;
  }

  /* Per-product packing if set, otherwise fall back to tier */
  packingForItem(item: any): number {
    if (!this.isOnlinePlatform) return 0;
    const product = this.products.find((p: any) => p.id === item.productId);
    if (this.platform === 'zomato') {
      const packing = item.zomato_packing ?? product?.zomato_packing;
      return (packing != null && Number(packing) > 0)
        ? Number(packing)
        : this.zomatoPackingRate(item.price);
    }
    if (this.platform === 'swiggy') {
      const packing = item.swiggy_packing ?? product?.swiggy_packing;
      return (packing != null && Number(packing) > 0)
        ? Number(packing)
        : this.swiggyPackingRate(item.price);
    }
    return 0;
  }

  get packingTotal(): number {
    if (!this.isOnlinePlatform) return 0;
    const total = this.cart.reduce((sum, item) => sum + this.packingForItem(item) * item.qty, 0);
    return this.platform === 'zomato' ? Math.min(total, 40) : total;
  }

  get finalTotal(): number {
    const t = this.subtotal + this.packingTotal - this.couponDiscount;
    return t > 0 ? t : 0;
  }


  /* ════════════════════════════════
     LIFECYCLE
  ════════════════════════════════ */
  ngOnInit() {
    this.isAdmin = this.authApi.isAdmin();

    this.customerName = this.store.getCustomerName();

    this.productApi.getAllBilling().subscribe({
      next: (res: any[]) => { this.products = res; },
      error: () => {}
    });

    this.store.cart$.subscribe(c => {
      this.cart = c;
      this.resetCoupon();
    });

    this.loadCategories();
    this.settingsApi.get().subscribe({
      next: s => {
        this.packingDefaults.zomato = Number(s.zomato_packing_default) || 0;
        this.packingDefaults.swiggy = Number(s.swiggy_packing_default) || 0;
      }
    });
  }

  loadCategories() {
    this.categories = [{ id: 0, name: 'All' }];
    this.productApi.getAllCategoriesBilling().subscribe({
      next: (res: any) => {
        this.categories = [{ id: 0, name: 'All' }, ...res.data];
      },
      error: () => {}
    });
  }

  /* ════════════════════════════════
     PRODUCT / FILTER
  ════════════════════════════════ */
  get filteredProducts() {
    let list = this.products;
    if (this.platform === 'zomato') list = list.filter(p => p.zomato_price);
    if (this.platform === 'swiggy') list = list.filter(p => p.swiggy_price);
    if (this.selectedCategory !== 'All') {
      list = list.filter(p => p.category === this.selectedCategory);
    }
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }

  effectivePrice(p: any): number {
    if (this.platform === 'zomato' && p.zomato_price) return Number(p.zomato_price);
    if (this.platform === 'swiggy' && p.swiggy_price) return Number(p.swiggy_price);
    return Number(p.price);
  }

  setPlatform(p: string) {
    if (this.platform === p) { this.platform = ''; this.paymentMethod = ''; this.clearBill(); return; }
    if (this.cart.length > 0) {
      if (!confirm('Changing platform will clear the current cart. Continue?')) return;
    }
    this.platform = p;
    this.paymentMethod = (p === 'zomato' || p === 'swiggy') ? 'UPI' : '';
    this.clearBill();
  }

  get isOnlinePlatform(): boolean {
    return this.platform === 'zomato' || this.platform === 'swiggy';
  }

  addProduct(product: any) {
    const existing = this.cart.find(item => item.productId === product.id);
    if (product.is_manual_price && existing) return;

    if (this.isOnlinePlatform) {
      this.openAddonModal(product);
    } else {
      this.store.add({ ...product, price: this.effectivePrice(product) });
      if (window.innerWidth <= 900) this.showCart = true;
    }
  }

  openAddonModal(product: any) {
    this.addonModal = { product, addons: [], selected: new Set(), loading: true };
    this.productApi.getAddons(product.id).subscribe({
      next: (addons: any[]) => {
        if (!this.addonModal) return;
        const platform = this.platform;
        const filtered = addons.filter(a => a.platform === platform || a.platform === 'both');
        if (filtered.length === 0) {
          // No add-ons → add directly without modal
          this.addonModal = null;
          this.store.add({ ...product, price: this.effectivePrice(product) });
          if (window.innerWidth <= 900) this.showCart = true;
        } else {
          this.addonModal.addons  = filtered;
          this.addonModal.loading = false;
        }
      },
      error: () => {
        // On error, add directly
        this.addonModal = null;
        this.store.add({ ...product, price: this.effectivePrice(product) });
        if (window.innerWidth <= 900) this.showCart = true;
      }
    });
  }

  toggleAddon(addonId: number) {
    if (!this.addonModal) return;
    if (this.addonModal.selected.has(addonId)) {
      this.addonModal.selected.delete(addonId);
    } else {
      this.addonModal.selected.add(addonId);
    }
  }

  confirmAddons() {
    if (!this.addonModal) return;
    const { product, addons, selected } = this.addonModal;
    this.addonModal = null;

    this.store.add({ ...product, price: this.effectivePrice(product) });

    for (const a of addons) {
      if (selected.has(a.id)) {
        this.store.addAddonItem({ name: a.name, price: Number(a.price) });
      }
    }
    if (window.innerWidth <= 900) this.showCart = true;
  }

  skipAddons() {
    if (!this.addonModal) return;
    const product = this.addonModal.product;
    this.addonModal = null;
    this.store.add({ ...product, price: this.effectivePrice(product) });
    if (window.innerWidth <= 900) this.showCart = true;
  }

  closeAddonModal() { this.addonModal = null; }

  /* ════════════════════════════════
     COUPON
  ════════════════════════════════ */
  applyCoupon() {
    const billId = this.store.getBillId();
    if (!billId)             { this.showError('Save bill before applying coupon'); return; }
    if (!this.couponCode.trim()) { this.showError('Enter coupon code'); return; }

    this.billApi.applyCoupon(billId, { coupon_code: this.couponCode }).subscribe({
      next: (res: any) => { this.couponDiscount = Number(res.coupon_discount) || 0; this.couponApplied = true; },
      error: (err)     => this.showError(err.error?.msg || 'Invalid coupon')
    });
  }

  removeCoupon() { this.resetCoupon(); }

  resetCoupon() {
    this.couponCode     = '';
    this.couponDiscount = 0;
    this.couponApplied  = false;
  }

  /* ════════════════════════════════
     MANUAL PRICE
  ════════════════════════════════ */
  updateManualPrice(item: any, price: string) {
    const val = Number(price);
    if (!val || val <= 0) return;
    this.store.updatePrice(item.productId, val);
  }

  /* ════════════════════════════════
     STOCK PRE-FLIGHT
  ════════════════════════════════ */
  /**
   * Verify the cart against current stock before saving / completing.
   * Returns `true` when it's safe to proceed.
   * Opens the out-of-stock modal and returns `false` when any product or
   * ingredient is short.
   */
  private async preflightStockOk(items: { productId: number; qty: number; name?: string }[]): Promise<boolean> {
    if (!items.length) return true;

    this.isChecking = true;
    try {
      const res = await firstValueFrom(this.billApi.checkStock(items));
      if (!res?.ok && res?.shortfall?.length) {
        this.outOfStockModal = { items: res.shortfall };
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Stock check failed, allowing save (server will re-validate)', err);
      return true;
    } finally {
      this.isChecking = false;
    }
  }

  closeOutOfStockModal() { this.outOfStockModal = null; }

  /* ════════════════════════════════
     SAVE PENDING
  ════════════════════════════════ */
  async savePending() {
    const snapshot = JSON.parse(JSON.stringify(this.store.getItems()));
    if (!snapshot.length) { this.showError('Add at least one item'); return; }

    const checkItems = snapshot.map((i: any) => ({
      productId: Number(i.productId),
      qty:       Number(i.qty),
      name:      i.name
    }));
    if (!(await this.preflightStockOk(checkItems))) return;

    const payload = {
      customer_name: this.customerName?.trim() || '',
      items: snapshot.map((i: any) => ({
        productId: i.productId != null ? Number(i.productId) : null,
        name:      i.name,
        price:     Number(i.price),
        qty:       Number(i.qty)
      })),
      platform:  this.platform || null,
      bill_date: this.billDate || null
    };

    this.isSaving = true;
    const billId  = this.store.getBillId();

    if (billId) {
      this.billApi.update(billId, payload).subscribe({
        next: () => { this.isSaving = false; this.clearBill(); this.refreshProducts(); },
        error: (err) => { this.isSaving = false; this.showError(err?.error?.message || 'Failed to update bill'); }
      });
    } else {
      this.billApi.create(payload).subscribe({
        next: () => { this.isSaving = false; this.clearBill(); this.refreshProducts(); },
        error: (err) => { this.isSaving = false; this.showError(err?.error?.message || 'Failed to create bill'); }
      });
    }
  }

  /* ════════════════════════════════
     COMPLETE BILL
  ════════════════════════════════ */
  async completeBill() {
    if (this.isOnlinePlatform && !this.customerName?.trim()) {
      this.showError('Order number is required for Zomato / Swiggy');
      return;
    }
    if (!this.paymentMethod && !this.isOnlinePlatform && !this.splitPayment) {
      this.showError('Select payment method');
      return;
    }
    if (this.splitPayment && !this.splitValid) {
      this.showError(`Split amounts must equal ₹${this.finalTotal.toFixed(2)} (got ₹${this.splitTotal.toFixed(2)})`);
      return;
    }

    const snapshot = JSON.parse(JSON.stringify(this.store.getItems()));
    if (!snapshot.length) { this.showError('Cart is empty'); return; }

    const items = snapshot.map((i: any) => ({
      productId: i.productId != null ? Number(i.productId) : null,
      name:      i.name,
      price:     Number(i.price),
      qty:       Number(i.qty)
    }));

    if (!(await this.preflightStockOk(items.map((i: any) => ({ productId: i.productId, qty: i.qty, name: i.name }))))) return;

    // Resolve effective payment fields
    const paymentMode = this.isOnlinePlatform ? 'UPI'
                      : this.splitPayment      ? 'SPLIT'
                      : this.paymentMethod;
    const cashAmt = this.splitPayment ? this.splitCash : null;
    const upiAmt  = this.splitPayment ? this.splitUpi  : null;

    this.isCompleting = true;
    const billId = this.store.getBillId();

    /* No existing bill (fresh cart) — create, then complete */
    if (!billId) {
      this.billApi.create({
        customer_name: this.customerName?.trim() || '',
        items,
        local_id:      crypto.randomUUID(),
        platform:      this.platform || null,
        bill_date:     this.billDate || null
      }).subscribe({
        next: (createRes: any) => {
          const newBillId = createRes.bill_id;
          this.billApi.complete(newBillId, {
            customer_name:   this.customerName,
            grand_total:     this.finalTotal,
            payment_mode:    paymentMode,
            cash_amount:     cashAmt,
            upi_amount:      upiAmt,
            discount_amount: this.couponDiscount || 0,
            bill_date:       this.billDate || null
          }).subscribe({
            next: () => {
              this.isCompleting = false;
              this.printReceipt(newBillId, items, this.finalTotal, paymentMode, this.customerName);
              this.clearBill();
              this.refreshProducts();
            },
            error: () => { this.isCompleting = false; this.showError('Failed to complete bill'); }
          });
        },
        error: () => { this.isCompleting = false; this.showError('Failed to complete bill'); }
      });
      return;
    }

    /* Existing pending bill — update items then complete */
    this.billApi.update(billId, { customer_name: this.customerName, items }).subscribe({
      next: () => {
        this.billApi.complete(billId, {
          customer_name:   this.customerName,
          grand_total:     this.finalTotal,
          payment_mode:    paymentMode,
          cash_amount:     cashAmt,
          upi_amount:      upiAmt,
          discount_amount: this.couponDiscount || 0,
          bill_date:       this.billDate || null
        }).subscribe({
          next:  () => {
            this.isCompleting = false;
            this.printReceipt(billId, items, this.finalTotal, paymentMode, this.customerName);
            this.clearBill();
            this.refreshProducts();
          },
          error: () => { this.isCompleting = false; this.showError('Failed to complete bill'); }
        });
      },
      error: () => { this.isCompleting = false; this.showError('Failed to update bill'); }
    });
  }

  /* ════════════════════════════════
     PRINT
  ════════════════════════════════ */
  printReceipt(
    billId      : number,
    items       : { name: string; price: number; qty: number }[],
    grandTotal  : number,
    paymentMode : string,
    customerName: string
  ) {
    if (!this.printer.isAndroid()) return;  // only works on Android with RawBT
    this.printer.printViaRawBT({
      billId,
      customerName,
      paymentMode,
      items,
      subtotal    : this.subtotal,
      discount    : this.couponDiscount,
      grandTotal
    });
  }

  /* ════════════════════════════════
     HELPERS
  ════════════════════════════════ */
  /* ════════════════════════════════
     SPLIT PAYMENT
  ════════════════════════════════ */
  setSplitPayment(on: boolean) {
    this.splitPayment = on;
    if (on) {
      this.paymentMethod = '';
      this.splitCash     = 0;
      this.splitUpi      = this.finalTotal;
    } else {
      this.splitCash = 0;
      this.splitUpi  = 0;
    }
  }

  onSplitCashChange() {
    const cash = Math.min(Math.max(0, this.splitCash), this.finalTotal);
    this.splitCash = +cash.toFixed(2);
    this.splitUpi  = +(this.finalTotal - this.splitCash).toFixed(2);
  }

  onSplitUpiChange() {
    const upi = Math.min(Math.max(0, this.splitUpi), this.finalTotal);
    this.splitUpi  = +upi.toFixed(2);
    this.splitCash = +(this.finalTotal - this.splitUpi).toFixed(2);
  }

  clearBill() {
    this.store.clear();
    this.customerName  = '';
    this.paymentMethod = '';
    this.billDate      = '';
    this.splitPayment  = false;
    this.splitCash     = 0;
    this.splitUpi      = 0;
    this.resetCoupon();
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/NoImage.webp';
  }




  refreshProducts() {
    this.productApi.getAllBilling().subscribe({
      next: (res: any[]) => {
        this.products = res;
        try { localStorage.setItem('pos_products', JSON.stringify(res)); } catch {}
      },
      error: () => {}
    });
  }

  trackByProductId(_: number, item: any) { return item.productId; }

  cartQty(productId: number): number {
    return this.cart.find(i => i.productId === productId)?.qty ?? 0;
  }

  availableServings(p: any): number {
    return Math.max(0, Number(p.servings_possible) - this.cartQty(p.id));
  }

  showIngredients(event: Event, product: any) {
    event.stopPropagation();
    this.ingredientModal = { product, items: [], loading: true };
    this.productApi.getRecipeByProduct(product.id).subscribe({
      next: (items: any[]) => {
        if (this.ingredientModal) {
          this.ingredientModal.items   = items;
          this.ingredientModal.loading = false;
        }
      },
      error: () => { if (this.ingredientModal) this.ingredientModal.loading = false; }
    });
  }

  closeIngredientModal() { this.ingredientModal = null; }

  /* ════════════════════════════════
     KEYBOARD SHORTCUTS
  ════════════════════════════════ */
  get shortcutProducts(): any[] {
    return this.products.filter(p => p.shortcut_key);
  }

  /** Products whose shortcut_key starts with the current buffer — for live highlight */
  get shortcutPartialMatches(): any[] {
    if (!this.shortcutBuffer) return [];
    const buf = this.shortcutBuffer.toLowerCase();
    return this.products.filter(p => p.shortcut_key?.toLowerCase().startsWith(buf));
  }

  /** Exact match for the current buffer */
  get shortcutExactMatch(): any | null {
    if (!this.shortcutBuffer) return null;
    const buf = this.shortcutBuffer.toLowerCase();
    return this.products.find(p => p.shortcut_key?.toLowerCase() === buf) ?? null;
  }

  private appendShortcutBuffer(char: string) {
    clearTimeout(this.shortcutTimer);
    this.shortcutBuffer += char;

    const partials = this.shortcutPartialMatches;

    if (partials.length === 0) {
      this.showError(`No product for code "${this.shortcutBuffer}"`);
      this.shortcutTimer = setTimeout(() => { this.shortcutBuffer = ''; }, 800);
    }
    // No auto-timer: user confirms with Enter, preventing accidental adds when typing slowly
  }

  confirmShortcut() {
    clearTimeout(this.shortcutTimer);
    const buf = this.shortcutBuffer;
    this.shortcutBuffer = '';
    if (!buf) return;
    const product = this.products.find(p => p.shortcut_key?.toLowerCase() === buf.toLowerCase());
    if (product) {
      this.addProduct(product);
      this.showSuccess(`Added: ${product.name}`);
    } else {
      this.showError(`No exact match for "${buf}"`);
    }
  }

  clearShortcutBuffer() {
    clearTimeout(this.shortcutTimer);
    this.shortcutBuffer = '';
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    // Escape — clear shortcut buffer first, then close modals
    if (e.key === 'Escape') {
      if (this.shortcutBuffer)     { this.clearShortcutBuffer();   return; }
      if (this.addonModal)         { this.closeAddonModal();       return; }
      if (this.ingredientModal)    { this.closeIngredientModal();  return; }
      if (this.outOfStockModal)    { this.closeOutOfStockModal();  return; }
      if (this.showShortcutsHelp)  { this.showShortcutsHelp = false; return; }
      return;
    }

    // ? — toggle shortcuts help (not inside input)
    if (e.key === '?' && !inInput) {
      this.showShortcutsHelp = !this.showShortcutsHelp;
      return;
    }

    // / or F2 — focus search (also clears any buffer)
    if ((e.key === '/' || e.key === 'F2') && !inInput) {
      e.preventDefault();
      this.clearShortcutBuffer();
      this.searchInputEl?.nativeElement.focus();
      return;
    }

    // Ctrl+S — Save Pending
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (!this.isOnlinePlatform && !this.isSaving && !this.isChecking && this.cart.length) {
        this.savePending();
      }
      return;
    }

    // Ctrl+Enter — Complete Bill
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (!this.isCompleting && !this.isChecking && this.cart.length) {
        this.completeBill();
      }
      return;
    }

    // Alt+C — Cash
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      if (!this.isOnlinePlatform) { this.setSplitPayment(false); this.paymentMethod = 'CASH'; }
      return;
    }
    // Alt+U — UPI
    if (e.altKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      if (!this.isOnlinePlatform) { this.setSplitPayment(false); this.paymentMethod = 'UPI'; }
      return;
    }
    // Alt+X — Split payment
    if (e.altKey && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      if (!this.isOnlinePlatform) this.setSplitPayment(!this.splitPayment);
      return;
    }

    // When not inside an input field:
    if (!inInput) {
      // F7 — Zomato platform
      if (e.key === 'F7') { e.preventDefault(); this.setPlatform('zomato'); return; }
      // F8 — Swiggy platform
      if (e.key === 'F8') { e.preventDefault(); this.setPlatform('swiggy'); return; }

      // Tab — cycle to next category
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const idx  = this.categories.findIndex(c => c.name === this.selectedCategory);
        const next = (idx + 1) % this.categories.length;
        this.selectedCategory = this.categories[next]?.name ?? 'All';
        return;
      }

      // Delete — clear buffer if active, otherwise remove last cart item
      if (e.key === 'Delete') {
        e.preventDefault();
        if (this.shortcutBuffer) { this.clearShortcutBuffer(); return; }
        if (this.cart.length) {
          const last = this.cart[this.cart.length - 1];
          this.store.update(last.productId, last.qty - 1, this.cart.length - 1);
        }
        return;
      }

      // Backspace — remove last character from buffer
      if (e.key === 'Backspace' && this.shortcutBuffer) {
        e.preventDefault();
        clearTimeout(this.shortcutTimer);
        this.shortcutBuffer = this.shortcutBuffer.slice(0, -1);
        return;
      }

      // Enter — confirm current buffer immediately (no waiting for timeout)
      if (e.key === 'Enter' && this.shortcutBuffer) {
        e.preventDefault();
        this.confirmShortcut();
        return;
      }

      // Shift+Letter → build the shortcut buffer (Shift required to avoid accidental triggers)
      // e.g. Shift+S → Samosa, Shift+S then Shift+B → SB (Salt Biscuit)
      // Press Enter to confirm the match
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey
          && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        e.preventDefault();
        this.appendShortcutBuffer(e.key.toUpperCase());
        return;
      }
    }
  }

  showError(msg: string) {
    this.errorMsg   = msg;
    this.successMsg = '';
    setTimeout(() => (this.errorMsg = ''), 3000);
  }

  showSuccess(msg: string) {
    this.successMsg = msg;
    this.errorMsg   = '';
    setTimeout(() => (this.successMsg = ''), 3000);
  }
}
