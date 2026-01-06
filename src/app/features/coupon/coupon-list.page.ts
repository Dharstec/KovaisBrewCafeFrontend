import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CouponApi } from '../../core/api/coupon.api';
import { CouponFormModal } from './coupon-form.modal';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, CouponFormModal],
  templateUrl: './coupon-list.page.html',
  styleUrls: ['./coupon-list.page.scss']
})
export class CouponListPage {

  api = inject(CouponApi);
 
  coupons: any[] = [];
  search = ''; 

  showModal = false;
  selectedCoupon: any = null;

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.getAll().subscribe(res => this.coupons = res);
    this.closeModal();
  }

  get filteredCoupons() {
    if (!this.search) return this.coupons;
    return this.coupons.filter(c =>
      c.code.toLowerCase().includes(this.search.toLowerCase())
    );
  }

  openCreate() {
    this.selectedCoupon = null;
    this.showModal = true;
  }

  openEdit(coupon: any) {
    this.selectedCoupon = coupon;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  confirmDelete(c: any) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    this.api.delete(c.id).subscribe(() => this.reload());
  }
}
