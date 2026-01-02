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

  /* ================= STATE ================= */
  products: any[] = [];
  cart: any[] = [];

  categories: any[] = [];
  selectedCategory = 'All';
  searchText = '';

  errorMsg = '';

  customerName = '';
  paymentMethod = '';

  /* ================= INIT ================= */
  ngOnInit() {
    this.productApi.getAllBilling()
      .subscribe((res: any[]) => this.products = res);

    this.store.cart$
      .subscribe(c => this.cart = c);

    this.loadCategories();
  }

  loadCategories() {
    this.productApi.getAllCategoriesBilling()
      .subscribe((res: any) => {
        this.categories = [{ id: 0, name: 'All' }, ...res.data];
      });
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

    // manual price item only once
    if (product.is_manual_price && existing) return;

    this.store.add(product);
  }

  /* ================= MANUAL PRICE ================= */
  updateManualPrice(item: any, price: string) {
    const val = Number(price);
    if (!val || val <= 0) return;
    this.store.updatePrice(item.productId, val);
  }

  /* ================= SAVE PENDING ================= */
  savePending() {

    // 🔥 snapshot cart (critical)
    const snapshot = JSON.parse(
      JSON.stringify(this.store.getItems())
    );

    if (!snapshot.length) {
      this.showError('Please add at least one item');
      return;
    }

    const payload = snapshot.map((i: { productId: any; name: any; price: any; qty: any; }) => ({
      productId: Number(i.productId),
      name: i.name,
      price: Number(i.price),
      qty: Number(i.qty)
    }));

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

    this.billApi.complete(billId).subscribe({
      next: () => this.clearBill(),
      error: () => this.showError('Failed to complete bill')
    });
  }

  /* ================= HELPERS ================= */
  clearBill() {
    this.store.clear();
    this.customerName = '';
    this.paymentMethod = '';
  }

  trackByProductId(index: number, item: any) {
    return item.productId;
  }

  showError(msg: string) {
    this.errorMsg = msg;
    setTimeout(() => (this.errorMsg = ''), 2500);
  }
}
