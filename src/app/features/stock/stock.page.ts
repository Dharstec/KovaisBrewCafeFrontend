import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-stock-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './stock.page.html',
  styleUrls: ['./stock.page.scss']
})
export class StockPage implements OnInit {
  private route = inject(ActivatedRoute);

  private http = inject(HttpClient);

 stocks: any[] = [];
  filtered: any[] = [];
  searchTerm = '';
  filterType: 'low' | 'out' | null = null;


  ngOnInit() {
      this.route.queryParams.subscribe(params => {
      this.filterType = params['filter'] || null;
      this.loadStock();
    });
  }

loadStock() {
    this.http
      .get<any[]>(`${environment.apiUrl}/stock`)
      .subscribe(res => {
        this.stocks = res.map(p => ({
          ...p,
          change_qty: null,
          reason: 'DAILY_REFILL'
        }));

        this.applyFilter();
      });
  }

  applyFilter() {
    if (this.filterType === 'low') {
      this.filtered = this.stocks.filter(
        p => p.current_qty <= p.min_qty && p.current_qty > 0
      );
    } else if (this.filterType === 'out') {
      this.filtered = this.stocks.filter(
        p => p.current_qty === 0
      );
    } else {
      this.filtered = this.stocks;
    }
  }

  get filteredStocks() {
    if (!this.searchTerm) return this.filtered;

    return this.filtered.filter(p =>
      p.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

 updateStock(p: any) {

  if (!p.change_qty || p.change_qty === 0) {
    alert('Enter quantity');
    return;
  }

  let qty = Number(p.change_qty);
  const oldStock = p.current_qty;

  // 🔁 normalize qty based on reason
  if (p.reason === 'USAGE' || p.reason === 'WASTAGE') {
    if (qty > 0) qty = -qty;
  }

  if (p.reason === 'DAILY_REFILL') {
    if (qty < 0) qty = Math.abs(qty);
  }

  if (p.reason === 'ADJUSTMENT') {
    // adjustment = final stock - current stock
    qty = qty - oldStock;
  }

  const newStock = oldStock + qty;

  // ❌ prevent negative stock (optional safety)
  if (newStock < 0) {
    alert('Stock cannot go below zero');
    return;
  }

  /* ✅ CONFIRMATION */
  const confirmed = confirm(
    `Are you sure you want to ${p.reason} stock?\n\n` +
    `Product : ${p.name}\n` +
    `Change Qty    : ${qty}\n\n` +
    `Stock will change:\n` +
    `FROM : ${oldStock}\n` +
    `TO   : ${newStock}`
  );

  if (!confirmed) return;

  /* ✅ API CALL */
  this.http.post(
    `${environment.apiUrl}/stock/adjust`,
    {
      product_id: p.id,
      change_qty: qty,
      reason: p.reason
    }
  ).subscribe({
    next: (res: any) => {

      // update UI
      p.current_qty = newStock;
      p.change_qty = null;

      /* ✅ AFTER UPDATE INFO */
      alert(
        `Stock updated successfully\n\n` +
        `${p.name}\n` +
        `Stock changed from ${oldStock} → ${newStock}`
      );
    },
    error: err => {
      alert(err.error?.message || 'Stock update failed');
    }
  });
}

}
