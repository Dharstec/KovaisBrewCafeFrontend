import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardApi } from '../../core/api/dashboard.api';
import { DashboardSummary } from '../../core/models/dashboard.model';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit {

  private api = inject(DashboardApi);

  data: DashboardSummary = {
    today_sales: 0,
    today_bills: 0,
    pending_bills: 0,
    products: 0,
    categories: 0,
    employees: 0,
    attendance: { present: 0, absent: 0 },
    stock: { total_items: 0, low_stock: 0, out_of_stock: 0 }
  };

  ngOnInit() {
    this.api.getSummary().subscribe(res => {
      this.data = res;
    });
  }
}
