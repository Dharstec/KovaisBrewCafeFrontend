import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BillApi }           from '../../core/api/bill.api';
import { BillingStore }      from '../../core/state/billing.store';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { AuthApi }           from '../../core/api/auth.api';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-pending-page',
  templateUrl: './pending.page.html',
  styleUrls: ['./pending.page.scss']
})
export class PendingPage implements OnInit {

  api          = inject(BillApi);
  store        = inject(BillingStore);
  router       = inject(Router);
  offlineQueue = inject(OfflineQueueService);
  auth         = inject(AuthApi);

  bills: any[] = [];
  isOnline  = navigator.onLine;
  isAdmin   = this.auth.isAdmin();

  async ngOnInit() {
    this.isOnline = navigator.onLine;
    await this.loadBills();
  }

  async loadBills() {
    // Load offline pending bills first
    const queue         = await this.offlineQueue.getAll();
    const offlineBills  = queue
      .filter(b => b.type === 'pending' && b.status === 'queued')
      .map(b => ({
        id:            null,
        local_id:      b.local_id,
        customer_name: b.customer_name,
        items:         b.items,
        grand_total:   b.items.reduce((s: number, i: any) => s + i.price * i.qty, 0),
        created_at:    b.created_at,
        isOffline:     true
      }));

    if (navigator.onLine) {
      this.api.pending().subscribe(res => {
        this.bills = [...offlineBills, ...res];
      });
    } else {
      this.bills = offlineBills;
    }
  }

  cancelBill(bill: any) {
    if (!confirm('Cancel this bill? Stock will be restored.')) return;

    if (bill.isOffline) {
      this.offlineQueue.remove(bill.local_id).then(() => this.loadBills());
      return;
    }

    this.api.cancel(bill.id).subscribe({
      next: () => this.loadBills(),
      error: (err) => alert(err.error?.message || 'Failed to cancel bill')
    });
  }

  edit(bill: any) {
    if (bill.isOffline) {
      // Load offline bill into store (no server bill_id yet)
      this.store.load(bill.items, null, bill.customer_name, bill.local_id);
    } else {
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
    }
    this.router.navigate(['/billing']);
  }
}
