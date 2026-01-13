import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BillingStore } from '../../core/state/billing.store';
import { ProductApi } from '../../core/api/product.api';
import { BillApi } from '../../core/api/bill.api';

@Component({
  standalone: true,
  selector: 'app-billing-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss']
})
export class BillingPage implements OnInit {

  /* ================= DEPENDENCIES ================= */
  store = inject(BillingStore);
  productApi = inject(ProductApi);
  billApi = inject(BillApi);
  LOW_STOCK_DEFAULT = 5;

  /* ================= STATE ================= */
  products: any[] = [];
  cart: any[] = [];

  categories: any[] = [];
  selectedCategory = 'All';
  searchText = '';

  errorMsg = '';

  customerName = '';
  paymentMethod = '';

  /* ===== COUPON STATE ===== */
  couponCode = '';
  couponDiscount = 0;
  couponApplied = false;

  /* ================= INIT ================= */
  ngOnInit() {
    this.productApi.getAllBilling()
      .subscribe((res: any[]) => this.products = res);

    this.store.cart$.subscribe(c => {
      this.cart = c;
      this.resetCoupon(); // 🔥 cart change = reset coupon
    });

    this.loadCategories();

    // 🔥 AUTO SYNC OFFLINE BILLS
    window.addEventListener('online', () => {
      this.syncOfflineBills();
    });
  }

  syncOfflineBills() {
    const offlineBills = JSON.parse(
      localStorage.getItem('offlineBills') || '[]'
    );

    if (!offlineBills.length) return;

    offlineBills.forEach((bill: any) => {
      this.billApi.create(bill.payload).subscribe({
        next: () => {
          // success → remove stored bills
          localStorage.removeItem('offlineBills');
        },
        error: () => {
          // keep it, try again later
          console.warn('Offline bill sync failed');
        }
      });
    });
  }


  loadCategories() {
    this.productApi.getAllCategoriesBilling()
      .subscribe((res: any) => {
        this.categories = [{ id: 0, name: 'All' }, ...res.data];
      });
  }

  /* ================= DERIVED TOTAL ================= */
  get subtotal() {
    return this.store.getTotal();
  }

  get finalTotal() {
    const total = this.subtotal - this.couponDiscount;
    return total > 0 ? total : 0;
  }

  /* ================= FILTER ================= */
  get filteredProducts() {
    let list = this.products;

    if (this.selectedCategory !== 'All') {
      list = list.filter(p => p.category === this.selectedCategory);
    }

    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    return list;
  }

  /* ================= PRODUCT CLICK ================= */
  addProduct(product: any) {
    const existing = this.cart.find(
      item => item.productId === product.id
    );

    if (product.is_manual_price && existing) return;
    this.store.add(product);
  }

  /* ================= COUPON ================= */
  applyCoupon() {
    const billId = this.store.getBillId();

    if (!billId) {
      this.showError('Save bill before applying coupon');
      return;
    }

    if (!this.couponCode.trim()) {
      this.showError('Enter coupon code');
      return;
    }

    this.billApi.applyCoupon(billId, {
      coupon_code: this.couponCode
    }).subscribe({
      next: (res: any) => {
        this.couponDiscount = Number(res.coupon_discount) || 0;
        this.couponApplied = true;
      },
      error: (err) => {
        this.showError(err.error?.msg || 'Invalid coupon');
      }
    });
  }

  removeCoupon() {
    this.resetCoupon();
  }

  resetCoupon() {
    this.couponCode = '';
    this.couponDiscount = 0;
    this.couponApplied = false;
  }

  /* ================= MANUAL PRICE ================= */
  updateManualPrice(item: any, price: string) {
    const val = Number(price);
    if (!val || val <= 0) return;
    this.store.updatePrice(item.productId, val);
  }

  /* ================= SAVE PENDING ================= */
  savePending() {
    const snapshot = JSON.parse(JSON.stringify(this.store.getItems()));

    if (!snapshot.length) {
      this.showError('Please add at least one item');
      return;
    }

    const payload = snapshot.map((i: any) => ({
      productId: Number(i.productId),
      name: i.name,
      price: Number(i.price),
      qty: Number(i.qty)
    }));

    // 🔥 OFFLINE → SAVE LOCALLY (DO NOT HIT API)
    if (!navigator.onLine) {
      const pendingBills = JSON.parse(
        localStorage.getItem('offlineBills') || '[]'
      );

      pendingBills.push({
        payload,
        createdAt: new Date().toISOString()
      });

      localStorage.setItem('offlineBills', JSON.stringify(pendingBills));

      this.clearBill();
      this.showError('No internet. Bill saved locally');
      return;
    }

    // 🔁 EXISTING FLOW (UNCHANGED)
    const billId = this.store.getBillId();

    if (billId) {
      this.billApi.update(billId, payload).subscribe({
        next: () => this.clearBill(),
        error: () => this.showError('Failed to update bill')
      });
    } else {
      this.billApi.create(payload).subscribe({
        next: () => this.clearBill(),
        error: () => this.showError('Failed to create bill')
      });
    }
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/NoImage.webp';
  }

  getIntQty(qty: any): number {
    return Math.floor(Number(qty || 0));
  }
  isOutOfStock(p: any) {
    return p.track_stock && this.getIntQty(p.current_qty) === 0;
  }

  isLowStock(p: any) {
    if (!p.track_stock) return false;

    const qty = this.getIntQty(p.current_qty);
    const min = p.min_qty > 0
      ? this.getIntQty(p.min_qty)
      : this.LOW_STOCK_DEFAULT;

    return qty > 0 && qty <= min;
  }


  /* ================= COMPLETE BILL ================= */
  completeBill() {
    const billId = this.store.getBillId();

    if (!billId) {
      this.showError('Save bill before completing');
      return;
    }

    if (!this.paymentMethod) {
      this.showError('Select payment method');
      return;
    }

    // 🔥 TAKE CURRENT CART SNAPSHOT
    const snapshot = JSON.parse(JSON.stringify(this.store.getItems()));

    const payload = snapshot.map((i: any) => ({
      productId: Number(i.productId),
      name: i.name,
      price: Number(i.price),
      qty: Number(i.qty)
    }));

    // 🔥 ONLY THIS CONDITION CHANGE:
    // If bill exists → update items → then complete
    this.billApi.update(billId, payload).subscribe({
      next: () => {
        this.billApi.complete(billId, {
          net_total: this.finalTotal,
          payment_mode: this.paymentMethod
        }).subscribe({
          next: () => this.clearBill(),
          error: () => this.showError('Failed to complete bill')
        });
      },
      error: () => this.showError('Failed to update bill')
    });
  }


  /* ================= HELPERS ================= */
  clearBill() {
    this.store.clear();
    this.customerName = '';
    this.paymentMethod = '';
    this.resetCoupon();
  }

  trackByProductId(index: number, item: any) {
    return item.productId;
  }

  showError(msg: string) {
    this.errorMsg = msg;
    setTimeout(() => (this.errorMsg = ''), 2500);
  }
}
