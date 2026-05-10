import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { BillingStore }      from '../../core/state/billing.store';
import { ProductApi }        from '../../core/api/product.api';
import { BillApi, StockShortfallEntry } from '../../core/api/bill.api';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
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
export class BillingPage implements OnInit, OnDestroy {

  /* ── deps ── */
  store        = inject(BillingStore);
  productApi   = inject(ProductApi);
  billApi      = inject(BillApi);
  offlineQueue = inject(OfflineQueueService);
  printer      = inject(PrinterService);
  settingsApi  = inject(SettingsApi);
  authApi      = inject(AuthApi);

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
  errorMsg         = '';
  successMsg       = '';
  isOnlineStatus   = navigator.onLine;
  isSaving         = false;
  isCompleting     = false;
  showCart         = false;
  syncPending      = 0;

  /* ── packing charges ── */
  packingDefaults = { zomato: 0, swiggy: 0 };

  /* ── admin: backdated billing ── */
  isAdmin  = false;
  billDate = '';
  todayStr = new Date().toISOString().split('T')[0];

  /* ── ingredient popup ── */
  ingredientModal: { product: any; items: any[]; loading: boolean } | null = null;

  /* ── out-of-stock pre-flight ── */
  outOfStockModal: { items: StockShortfallEntry[] } | null = null;
  isChecking = false;


  /* ── listeners ── */
  private onlineHandler  = async () => { this.isOnlineStatus = true;  await this.syncOfflineQueue(); };
  private offlineHandler = ()       => { this.isOnlineStatus = false; this.showError('You are offline'); };

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
  async ngOnInit() {
    this.isAdmin = this.authApi.isAdmin();
    this.isOnlineStatus = navigator.onLine;
    window.addEventListener('online',  this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    this.customerName = this.store.getCustomerName();

    // Load from cache immediately so offline users see products instantly
    try {
      const cached = localStorage.getItem('pos_products');
      if (cached) this.products = JSON.parse(cached);
    } catch {}

    // Then refresh from API when online
    this.productApi.getAllBilling().subscribe({
      next: (res: any[]) => {
        this.products = res;
        try { localStorage.setItem('pos_products', JSON.stringify(res)); } catch {}
      },
      error: () => {}  // already loaded from cache above
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

    // Count queued offline bills
    const q = await this.offlineQueue.getAll();
    this.syncPending = q.filter(b => b.status === 'queued').length;
  }

  ngOnDestroy() {
    window.removeEventListener('online',  this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  loadCategories() {
    // Load from cache immediately
    try {
      const cached = localStorage.getItem('pos_categories');
      this.categories = cached ? JSON.parse(cached) : [{ id: 0, name: 'All' }];
    } catch {
      this.categories = [{ id: 0, name: 'All' }];
    }

    // Refresh from API when online
    this.productApi.getAllCategoriesBilling().subscribe({
      next: (res: any) => {
        this.categories = [{ id: 0, name: 'All' }, ...res.data];
        try { localStorage.setItem('pos_categories', JSON.stringify(this.categories)); } catch {}
      },
      error: () => {} // already loaded from cache above
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
    this.store.add({ ...product, price: this.effectivePrice(product) });
    if (window.innerWidth <= 900) this.showCart = true;
  }

  /* ════════════════════════════════
     COUPON
  ════════════════════════════════ */
  applyCoupon() {
    if (!navigator.onLine) { this.showError('Internet required to apply coupon'); return; }
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
   * Skips the network call when offline — the offline queue will sync later
   * and the backend re-validates on the final write.
   */
  private async preflightStockOk(items: { productId: number; qty: number; name?: string }[]): Promise<boolean> {
    if (!items.length) return true;
    if (!navigator.onLine) return true;

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

    // Ensure a local_id exists (for idempotency on retry)
    if (!this.store.getLocalId()) {
      this.store.setLocalId(this.offlineQueue.generateId());
    }
    const local_id = this.store.getLocalId();

    const payload = {
      customer_name: this.customerName?.trim() || '',
      items: snapshot.map((i: any) => ({
        productId: Number(i.productId),
        name:      i.name,
        price:     Number(i.price),
        qty:       Number(i.qty)
      })),
      local_id,
      platform:  this.platform || null,
      bill_date: this.billDate || null
    };

    /* ── OFFLINE path ── */
    if (!navigator.onLine) {
      const offlineBill = {
        local_id,
        type:          'pending' as const,
        bill_id:       this.store.getBillId(),
        customer_name: payload.customer_name,
        items:         payload.items,
        platform:      this.platform || null,
        created_at:    new Date().toISOString(),
        status:        'queued' as const
      };
      await this.offlineQueue.add(offlineBill);
      this.syncPending++;
      this.showSuccess('Saved offline — will sync when connected');
      this.clearBill();
      return;
    }

    /* ── ONLINE path ── */
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
    if (!this.paymentMethod && !this.isOnlinePlatform) { this.showError('Select payment method'); return; }

    const snapshot = JSON.parse(JSON.stringify(this.store.getItems()));
    if (!snapshot.length) { this.showError('Cart is empty'); return; }

    const items = snapshot.map((i: any) => ({
      productId: Number(i.productId),
      name:      i.name,
      price:     Number(i.price),
      qty:       Number(i.qty)
    }));

    if (!(await this.preflightStockOk(items.map((i: any) => ({ productId: i.productId, qty: i.qty, name: i.name }))))) return;

    // Ensure local_id
    if (!this.store.getLocalId()) {
      this.store.setLocalId(this.offlineQueue.generateId());
    }
    const local_id = this.store.getLocalId();

    /* ── OFFLINE path ── */
    if (!navigator.onLine) {
      const offlineBill = {
        local_id,
        type:            'complete' as const,
        bill_id:         this.store.getBillId(),
        customer_name:   this.customerName?.trim() || '',
        items,
        payment_mode:    this.paymentMethod,
        grand_total:     this.finalTotal,
        discount_amount: this.couponDiscount || 0,
        platform:        this.platform || null,
        created_at:      new Date().toISOString(),
        status:          'queued' as const
      };
      await this.offlineQueue.add(offlineBill);
      this.syncPending++;
      this.showSuccess('Bill queued — will complete when connected');
      this.printReceipt(0, items, offlineBill.grand_total, offlineBill.payment_mode, offlineBill.customer_name);
      this.clearBill();
      return;
    }

    /* ── ONLINE path ── */
    this.isCompleting = true;

    /* Zomato/Swiggy — create + complete in one shot (no pre-save needed) */
    if (this.isOnlinePlatform) {
      const local_id = this.store.getLocalId() || this.offlineQueue.generateId();
      this.billApi.syncOffline({
        customer_name: this.customerName?.trim() || '',
        items,
        payment_mode:  'UPI',
        grand_total:   this.finalTotal,
        local_id,
        platform:      this.platform,
        bill_date:     this.billDate || null
      }).subscribe({
        next: (res: any) => {
          this.isCompleting = false;
          this.printReceipt(res.bill_id || 0, items, this.finalTotal, 'UPI', this.customerName);
          this.clearBill();
          this.refreshProducts();
        },
        error: () => { this.isCompleting = false; this.showError('Failed to complete bill'); }
      });
      return;
    }

    const billId = this.store.getBillId();
    if (!billId) { this.isCompleting = false; this.showError('Save bill before completing'); return; }

    this.billApi.update(billId, { customer_name: this.customerName, items }).subscribe({
      next: () => {
        this.billApi.complete(billId, {
          customer_name:   this.customerName,
          grand_total:     this.finalTotal,
          payment_mode:    this.paymentMethod,
          discount_amount: this.couponDiscount || 0,
          bill_date:       this.billDate || null
        }).subscribe({
          next:  () => {
            this.isCompleting = false;
            this.printReceipt(billId, items, this.finalTotal, this.paymentMethod, this.customerName);
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
     OFFLINE SYNC (when back online)
  ════════════════════════════════ */
  async syncOfflineQueue() {
    const queue = await this.offlineQueue.getAll();
    const pending = queue.filter(b => b.status === 'queued');
    if (!pending.length) return;

    for (const bill of pending) {
      try {
        if (bill.type === 'pending') {
          await firstValueFrom(
            this.billApi.create({
              customer_name: bill.customer_name,
              items:         bill.items,
              local_id:      bill.local_id,
              platform:      bill.platform || null
            })
          );
        } else {
          // type === 'complete'
          if (bill.bill_id) {
            await firstValueFrom(
              this.billApi.update(bill.bill_id, { customer_name: bill.customer_name, items: bill.items })
            );
            await firstValueFrom(
              this.billApi.complete(bill.bill_id, {
                customer_name:   bill.customer_name,
                grand_total:     bill.grand_total,
                payment_mode:    bill.payment_mode,
                discount_amount: bill.discount_amount || 0
              })
            );
          } else {
            await firstValueFrom(
              this.billApi.syncOffline({
                customer_name:   bill.customer_name,
                items:           bill.items,
                payment_mode:    bill.payment_mode!,
                grand_total:     bill.grand_total!,
                discount_amount: bill.discount_amount || 0,
                local_id:        bill.local_id,
                platform:        bill.platform || null
              })
            );
          }
        }
        await this.offlineQueue.remove(bill.local_id);
      } catch (e) {
        console.warn('Sync failed for', bill.local_id, e);
      }
    }

    const remaining = await this.offlineQueue.getAll();
    this.syncPending = remaining.filter(b => b.status === 'queued').length;
    if (this.syncPending === 0) {
      this.showSuccess('All offline bills synced!');
    }
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
  clearBill() {
    this.store.clear();
    this.customerName  = '';
    this.paymentMethod = '';
    this.billDate      = '';
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
