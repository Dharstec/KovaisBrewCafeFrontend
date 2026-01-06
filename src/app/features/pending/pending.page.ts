import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BillApi } from '../../core/api/bill.api';
import { BillingStore } from '../../core/state/billing.store';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-pending-page',
  templateUrl: './pending.page.html',
  styleUrls: ['./pending.page.scss']
})
export class PendingPage {

  api = inject(BillApi);
  store = inject(BillingStore);
  router = inject(Router);

  bills: any[] = [];

  ngOnInit() {
    this.api.pending().subscribe(res => {
      this.bills = res;
    });
  }

  edit(bill: any) {
    this.store.load(
      bill.items.map((i: any) => ({
        productId: i.productid,
        name: i.name,
        price: Number(i.price),
        qty: Number(i.qty)
      })),
      bill.id
    );

    this.router.navigate(['/billing']);
  }
}
