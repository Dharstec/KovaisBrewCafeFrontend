import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BillingStore {

  private cartSubject = new BehaviorSubject<any[]>([]);
  cart$ = this.cartSubject.asObservable();

  private billId: number | null = null;
  private customerName: string = '';

  /* ================= ADD PRODUCT ================= */
  add(product: any) {
    const cart = [...this.cartSubject.value];
    const found = cart.find(i => i.productId === product.id);

    if (found) {
      found.qty++;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        is_manual_price: !!product.is_manual_price // ✅ IMPORTANT
      });
    }

    this.cartSubject.next(cart);
  }

  /* ================= UPDATE QTY ================= */
  update(productId: number, qty: number) {
    const cart = this.cartSubject.value
      .map(i => i.productId === productId ? { ...i, qty } : i)
      .filter(i => i.qty > 0);

    this.cartSubject.next(cart);
  }

  /* ================= UPDATE PRICE (MANUAL ONLY) ================= */
  updatePrice(productId: number, price: number) {
    const cart = this.cartSubject.value.map(i => {
      if (i.productId === productId && i.is_manual_price) {
        return { ...i, price };
      }
      return i;
    });

    this.cartSubject.next(cart);
  }

  /* ================= LOAD EXISTING BILL ================= */
  load(items: any[], billId: number, name: string) {
    this.billId = billId;
    this.customerName = name?.trim() || '';
    this.cartSubject.next(
      items.map(i => ({
        productId: i.productId,
        name: i.name,
        price: Number(i.price),
        qty: Number(i.qty),
        is_manual_price: !!i.is_manual_price // safe default
      }))
    );
  }

  /* ================= HELPERS ================= */
  getTotal(): number {
    return this.cartSubject.value.reduce(
      (sum, i) => sum + i.price * i.qty, 0
    );
  }

  getItems(): any[] {
    return this.cartSubject.value;
  }

  getBillId(): number | null {
    return this.billId;
  }

  getCustomerName(): string {
    return this.customerName;
  }

  setBillId(id: number) {
    this.billId = id;
  }

  clear() {
    this.billId = null;
    this.customerName = '';
    this.cartSubject.next([]);
  }
}
