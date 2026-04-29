import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BillingStore {

  private cartSubject = new BehaviorSubject<any[]>([]);
  cart$ = this.cartSubject.asObservable();

  private billId:   number | null = null;
  private localId:  string        = '';
  private customerName: string    = '';

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
        is_manual_price: !!product.is_manual_price,
        zomato_packing:  product.zomato_packing  != null ? Number(product.zomato_packing)  : null,
        swiggy_packing:  product.swiggy_packing  != null ? Number(product.swiggy_packing)  : null
      });
    }
    this.cartSubject.next(cart);
  }

  /* ── UPDATE QTY ── */
  update(productId: number, qty: number) {
    const cart = this.cartSubject.value
      .map(i  => i.productId === productId ? { ...i, qty } : i)
      .filter(i => i.qty > 0);
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
  load(items: any[], billId: number | null, name: string, localId = '') {
    this.billId      = billId;
    this.localId     = localId;
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
  getLocalId():      string          { return this.localId; }
  getCustomerName(): string          { return this.customerName; }

  setBillId(id: number)       { this.billId  = id; }
  setLocalId(lid: string)     { this.localId = lid; }

  clear() {
    this.billId       = null;
    this.localId      = '';
    this.customerName = '';
    this.cartSubject.next([]);
  }
}
