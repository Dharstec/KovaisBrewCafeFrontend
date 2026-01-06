import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-stock-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './stock.page.html',
  styleUrls: ['./stock.page.scss']
})
export class StockPage implements OnInit {

  private http = inject(HttpClient);

  stocks: any[] = [];
  searchTerm: string = '';

  ngOnInit() {
    this.loadStock();
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
      });
  }

  get filteredStocks() {
    if (!this.searchTerm) {
      return this.stocks;
    }

    return this.stocks.filter(p =>
      p.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  updateStock(p: any) {

    if (!p.change_qty || p.change_qty === 0) {
      alert('Enter quantity');
      return;
    }

    let qty = Number(p.change_qty);

    if (p.reason === 'WASTAGE' && qty > 0) {
      qty = -qty;
    }

    this.http.post(
      `${environment.apiUrl}/stock/adjust`,
      {
        product_id: p.id,
        change_qty: qty,
        reason: p.reason
      }
    ).subscribe({
      next: (res: any) => {
        p.current_qty = res.current_qty;
        p.change_qty = null;
      },
      error: err => {
        alert(err.error?.message || 'Stock update failed');
      }
    });
  }
}
