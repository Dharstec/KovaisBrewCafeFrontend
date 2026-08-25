import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillApi } from '../../core/api/bill.api';
import { ProductApi } from '../../core/api/product.api';
import { AuthApi } from '../../core/api/auth.api';
import { ToastService } from '../../core/services/toast.service';

@Component({
  standalone: true,
  selector: 'app-completed-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './completed.page.html',
  styleUrls: ['./completed.page.scss']
})
export class CompletedPage implements OnInit {

  auth       = inject(AuthApi);
  toast      = inject(ToastService);
  productApi = inject(ProductApi);

  bills: any[] = [];

  /* ROLE */
  isAdmin = this.auth.isAdmin();

  /* DATE FILTER */
  startDate = '';
  endDate   = '';

  /* PAGINATION */
  page       = 1;
  limit      = 20;
  totalPages = 1;
  pages: number[] = [];

  /* TOTALS */
  cashTotal    = 0;
  upiTotal     = 0;
  grandTotal   = 0;

  /* PRINT */
  printBillData: any = null;

  /* EDIT MODAL */
  editModal: {
    bill: any;
    items: { productId: number; name: string; price: number; qty: number }[];
    customerName: string;
    saving: boolean;
    error: string;
    addProductId: number | null;
  } | null = null;

  allProducts: any[] = [];
  productsLoaded = false;

  constructor(private api: BillApi) { }

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];
    this.startDate = today;
    this.endDate   = today;
    this.loadBills();
  }

  loadBills() {
    this.api.completed(
      this.startDate,
      this.endDate,
      this.page,
      this.limit
    ).subscribe({
      next: res => {
        this.bills        = res.data;
        this.totalPages   = res.totalPages;
        this.pages        = Array.from({ length: this.totalPages }, (_, i) => i + 1);
        this.cashTotal    = Number(res.summary?.cash_total    || 0);
        this.upiTotal     = Number(res.summary?.upi_total     || 0);
        this.grandTotal   = Number(res.summary?.grand_total   || 0);
      },
      error: () => this.toast.error('Load failed', 'Could not fetch completed bills.')
    });
  }

  applyDateFilter() {
    this.page = 1;
    this.loadBills();
  }

  /* PAGINATION */
  goTo(p: number) { this.page = p; this.loadBills(); }
  next() { if (this.page < this.totalPages) { this.page++; this.loadBills(); } }
  prev() { if (this.page > 1)              { this.page--; this.loadBills(); } }

  /* PRINT RECEIPT */
  printBill(bill: any) {
    this.printBillData = bill;
    setTimeout(() => window.print(), 100);
  }

  /* ══════════════════════════════════════
     DELETE BILL
  ══════════════════════════════════════ */
  deletingBillId: number | null = null;

  deleteBill(bill: any) {
    if (!confirm(`Delete Bill #${bill.id}? This will restore stock and cannot be undone.`)) return;
    this.deletingBillId = bill.id;
    this.api.deleteCompleted(bill.id).subscribe({
      next: () => {
        this.toast.success('Bill deleted', `Bill #${bill.id} deleted and stock restored.`);
        this.deletingBillId = null;
        this.loadBills();
      },
      error: (err) => {
        this.toast.error('Delete failed', err.error?.msg || 'Could not delete bill.');
        this.deletingBillId = null;
      }
    });
  }

  /* ══════════════════════════════════════
     EDIT MODAL
  ══════════════════════════════════════ */
  openEdit(bill: any) {
    this.editModal = {
      bill,
      items: bill.items.map((i: any) => ({
        productId: i.productId ?? i.productid,
        name:      i.name,
        price:     Number(i.price),
        qty:       Number(i.qty)
      })),
      customerName: bill.customer_name || '',
      saving: false,
      error: '',
      addProductId: null
    };

    if (!this.productsLoaded) {
      this.productApi.getAllBilling().subscribe({
        next: (res: any[]) => { this.allProducts = res; this.productsLoaded = true; },
        error: () => {}
      });
    }
  }

  closeEdit() { this.editModal = null; }

  editChangeQty(index: number, delta: number) {
    if (!this.editModal) return;
    const item = this.editModal.items[index];
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      this.editModal.items.splice(index, 1);
    } else {
      item.qty = newQty;
    }
  }

  editRemoveItem(index: number) {
    this.editModal?.items.splice(index, 1);
  }

  editAddProduct() {
    if (!this.editModal || !this.editModal.addProductId) return;
    const product = this.allProducts.find(p => p.id === Number(this.editModal!.addProductId));
    if (!product) return;

    const existing = this.editModal.items.find(i => i.productId === product.id);
    if (existing) {
      existing.qty++;
    } else {
      this.editModal.items.push({ productId: product.id, name: product.name, price: Number(product.price), qty: 1 });
    }
    this.editModal.addProductId = null;
  }

  get editTotal(): number {
    if (!this.editModal) return 0;
    return this.editModal.items.reduce((s, i) => s + i.price * i.qty, 0);
  }

  saveEdit() {
    if (!this.editModal) return;
    if (!this.editModal.items.length) {
      this.editModal.error = 'Add at least one item';
      return;
    }
    this.editModal.saving = true;
    this.editModal.error  = '';

    this.api.editCompleted(this.editModal.bill.id, {
      customer_name: this.editModal.customerName,
      items: this.editModal.items
    }).subscribe({
      next: () => {
        this.toast.success('Bill updated', `Bill #${this.editModal!.bill.id} has been updated.`);
        this.closeEdit();
        this.loadBills();
      },
      error: (err) => {
        if (this.editModal) {
          this.editModal.saving = false;
          this.editModal.error  = err.error?.message || 'Update failed';
        }
      }
    });
  }
}
