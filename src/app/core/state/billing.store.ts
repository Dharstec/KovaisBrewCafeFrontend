import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BillingStore {

  private cartSubject = new BehaviorSubject<any[]>([]);
  cart$ = this.cartSubject.asObservable();

  private billId:       number | null = null;
  private customerName: string        = '';

  /* ── ADD ── */
  add(product: any) {
    const cart  = [...this.cartSubject.value];
    const found = cart.find(i => i.productId === product.id);
    if (found) {
      found.qty++;
    } else {
      cart.push({
        productId:       product.id,
        name:            product.name,
        price:           product.price,
        qty:             1,
        is_manual_price: !!product.is_manual_price
      });
    }
    this.cartSubject.next(cart);
  }

  /* ── ADD ADDON LINE ITEM (no productId — not a real product) ── */
  addAddonItem(addon: { name: string; price: number }) {
    const cart = [...this.cartSubject.value];
    cart.push({
      productId:       null,
      name:            addon.name,
      price:           addon.price,
      qty:             1,
      is_manual_price: false,
      is_addon:        true
    });
    this.cartSubject.next(cart);
  }

  /* ── UPDATE QTY — works for both regular items (by productId) and addon items (by index) ── */
  update(productId: number | null, qty: number, index?: number) {
    let cart: any[];
    if (productId === null && index !== undefined) {
      cart = this.cartSubject.value.map((i, idx) =>
        idx === index ? { ...i, qty } : i
      ).filter(i => i.qty > 0);
    } else {
      cart = this.cartSubject.value
        .map(i => i.productId === productId ? { ...i, qty } : i)
        .filter(i => i.qty > 0);
    }
    this.cartSubject.next(cart);
  }

  /* ── UPDATE PRICE (MANUAL) ── */
  updatePrice(productId: number, price: number) {
    const cart = this.cartSubject.value.map(i =>
      i.productId === productId && i.is_manual_price ? { ...i, price } : i
    );
    this.cartSubject.next(cart);
  }

  /* ── LOAD EXISTING BILL ── */
  load(items: any[], billId: number | null, name: string) {
    this.billId       = billId;
    this.customerName = name?.trim() || '';
    this.cartSubject.next(
      items.map(i => ({
        productId:       i.productId,
        name:            i.name,
        price:           Number(i.price),
        qty:             Number(i.qty),
        is_manual_price: !!i.is_manual_price
      }))
    );
  }

  /* ── HELPERS ── */
  getTotal():        number          { return this.cartSubject.value.reduce((s, i) => s + i.price * i.qty, 0); }
  getItems():        any[]           { return this.cartSubject.value; }
  getBillId():       number | null   { return this.billId; }
  getCustomerName(): string          { return this.customerName; }

  setBillId(id: number) { this.billId = id; }

  clear() {
    this.billId       = null;
    this.customerName = '';
    this.cartSubject.next([]);
  }
}
