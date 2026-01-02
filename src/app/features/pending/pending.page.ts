import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BillApi } from '../../core/api/bill.api';
import { BillingStore } from '../../core/state/billing.store';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-pending-page',
  template: `
<div class="pending">

  <h1>Pending Bills</h1>

  <div class="list" *ngIf="bills.length; else empty">

    <div
      class="bill"
      *ngFor="let b of bills"
      (dblclick)="edit(b)"
    >

      <!-- HEADER -->
      <div class="top">
        <div>
          <b>Bill #{{ b.id }}</b>
          <div class="date">
            {{ b.created_at | date:'short' }}
          </div>
        </div>

        <div class="amount">
          ₹ {{ b.grand_total }}
        </div>
      </div>

      <!-- ITEMS -->
      <div class="items">
        <div class="item" *ngFor="let i of b.items">
          <span>{{ i.name }} × {{ i.qty }}</span>
          <span>₹ {{ i.price * i.qty }}</span>
        </div>
      </div>

    </div>

  </div>

  <ng-template #empty>
    <p class="empty">No pending bills</p>
  </ng-template>

</div>
`,
  styles: [`
.pending {
  padding: 20px;
  background: #f4f6f8;
  min-height: calc(100vh - 60px);
  font-family: Inter, system-ui;
}

h1 {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 16px;
}

.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.bill {
  background: #fff;
  padding: 16px;
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(0,0,0,.06);
  cursor: pointer;
}

.bill:hover {
  box-shadow: 0 8px 22px rgba(0,0,0,.1);
}

/* HEADER */
.top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.amount {
  font-size: 18px;
  font-weight: 700;
  color: #f59e0b;
}

.date {
  font-size: 12px;
  color: #777;
}

/* ITEMS */
.items {
  border-top: 1px dashed #ddd;
  margin-top: 8px;
  padding-top: 8px;
}

.item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin: 4px 0;
}

.empty {
  text-align: center;
  margin-top: 40px;
  color: #999;
}
`]
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