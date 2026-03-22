import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { AuthApi } from '../../core/api/auth.api';

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
  private auth = inject(AuthApi);

  isAdmin: boolean = false;

  stocks: any[] = [];
  filtered: any[] = [];
  searchTerm = '';
  filterType: 'low' | 'out' | null = null;

  /* ==============================
     INIT
     ============================== */
  ngOnInit(): void {

    this.isAdmin = this.auth.isAdmin();

    this.route.queryParams.subscribe(params => {
      this.filterType = params['filter'] || null;
      this.loadStock();
    });
  }

  /* ==============================
     LOAD STOCK
     ============================== */
  loadStock(): void {
    this.http
      .get<any[]>(`${environment.apiUrl}/stock`)
      .subscribe({
        next: res => {
          this.stocks = res.map(p => ({
            ...p,
            change_qty: null,
            reason: 'DAILY_REFILL'
          }));
          this.applyFilter();
        },
        error: () => alert('Failed to load stock')
      });
  }

  /* ==============================
     FILTER
     ============================== */
  applyFilter(): void {

    if (this.filterType === 'low') {
      this.filtered = this.stocks.filter(
        p => p.current_qty <= p.min_qty && p.current_qty > 0
      );

    } else if (this.filterType === 'out') {
      this.filtered = this.stocks.filter(
        p => p.current_qty === 0
      );

    } else {
      this.filtered = [...this.stocks];
    }
  }

  get filteredStocks() {
    if (!this.searchTerm) return this.filtered;

    return this.filtered.filter(p =>
      p.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  /* ==============================
     UPDATE STOCK
     ============================== */
  updateStock(p: any): void {

    if (!p.change_qty || p.change_qty === 0) {
      alert('Enter quantity');
      return;
    }

    /* 🔒 FRONTEND SECURITY */
    if (!this.isAdmin && p.reason !== 'DAILY_REFILL') {
      alert('You are not authorized to perform this action');
      return;
    }

    let qty = Number(p.change_qty);
    const oldStock = p.current_qty;

    /* ======================
       NORMALIZE LOGIC
       ====================== */

    // REFILL → always positive
    if (p.reason === 'DAILY_REFILL') {
      qty = Math.abs(qty);
    }

    // USAGE / WASTAGE → always negative
    if (p.reason === 'USAGE' || p.reason === 'WASTAGE') {
      qty = -Math.abs(qty);
    }

    // ADJUSTMENT → allow +/- freely
    // (no conversion needed)

    const newStock = oldStock + qty;

    if (newStock < 0) {
      alert('Stock cannot go below zero');
      return;
    }

    /* ======================
       CONFIRMATION
       ====================== */
    const confirmed = confirm(
      `Are you sure you want to ${p.reason} stock?\n\n` +
      `Product : ${p.name}\n` +
      `Change Qty : ${qty}\n\n` +
      `FROM : ${oldStock}\n` +
      `TO   : ${newStock}`
    );

    if (!confirmed) return;

    /* ======================
       API CALL
       ====================== */
    this.http.post(
      `${environment.apiUrl}/stock/adjust`,
      {
        product_id: p.id,
        change_qty: qty,
        reason: p.reason
      }
    ).subscribe({
      next: () => {

        p.current_qty = newStock;
        p.change_qty = null;

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