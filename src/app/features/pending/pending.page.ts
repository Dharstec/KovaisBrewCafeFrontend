import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BillApi }      from '../../core/api/bill.api';
import { BillingStore } from '../../core/state/billing.store';
import { AuthApi }      from '../../core/api/auth.api';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-pending-page',
  templateUrl: './pending.page.html',
  styleUrls: ['./pending.page.scss']
})
export class PendingPage implements OnInit {

  api    = inject(BillApi);
  store  = inject(BillingStore);
  router = inject(Router);
  auth   = inject(AuthApi);

  bills: any[] = [];
  isAdmin = this.auth.isAdmin();

  ngOnInit() {
    this.loadBills();
  }

  loadBills() {
    this.api.pending().subscribe(res => {
      this.bills = res;
    });
  }

  cancelBill(bill: any) {
    if (!confirm('Cancel this bill?')) return;
    this.api.cancel(bill.id).subscribe({
      next:  () => this.loadBills(),
      error: (err) => alert(err.error?.message || 'Failed to cancel bill')
    });
  }

  edit(bill: any) {
    this.store.load(
      bill.items.map((i: any) => ({
        productId: i.productId ?? i.productid,
        name:      i.name,
        price:     Number(i.price),
        qty:       Number(i.qty)
      })),
      bill.id,
      bill.customer_name
    );
    this.router.navigate(['/billing']);
  }
}
