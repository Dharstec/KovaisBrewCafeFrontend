import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-add-stock',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-stock.page.html',
  styleUrls: ['./add-stock.page.scss']
})
export class AddStockPage implements OnInit {

  private http = inject(HttpClient);

  products: any[] = [];

  product_id: number | null = null;
  inputQty: number | null = null;
  reason: 'DAILY_REFILL' | 'WASTAGE' | 'ADJUSTMENT' = 'DAILY_REFILL';

  selectedProduct: any = null;

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.http
      .get<any[]>(`${environment.apiUrl}/stock`)
      .subscribe(res => this.products = res);
  }

  onProductChange() {
    this.selectedProduct =
      this.products.find(p => p.id === this.product_id) || null;

    this.inputQty = null;
  }

  canSave(): boolean {
    return !!(
      this.selectedProduct &&
      this.inputQty !== null &&
      this.inputQty >= 0
    );
  }

  save() {
    if (!this.canSave() || !this.selectedProduct) return;

    const unitValue = this.selectedProduct.unit_value || 1;
    const baseQty = Math.round(this.inputQty! * unitValue);

    let change_qty = 0;

    if (this.reason === 'DAILY_REFILL') {
      change_qty = baseQty;
    }

    if (this.reason === 'WASTAGE') {
      change_qty = -baseQty;
    }

    // 🔥 EDIT STOCK (SET EXACT VALUE)
    if (this.reason === 'ADJUSTMENT') {
      change_qty = baseQty - this.selectedProduct.stock_qty;
    }

    this.http.post(
      `${environment.apiUrl}/stock/adjust`,
      {
        product_id: this.product_id,
        change_qty,
        reason: this.reason
      }
    ).subscribe(() => {
      alert('Stock updated successfully');
      this.inputQty = null;
    });
  }
}
