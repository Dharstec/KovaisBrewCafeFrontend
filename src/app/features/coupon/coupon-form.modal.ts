import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CouponApi } from '../../core/api/coupon.api';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-coupon-form-modal',
  templateUrl: './coupon-form.modal.html',
  styleUrls: ['./coupon-form.modal.scss']
})
export class CouponFormModal {

  api = inject(CouponApi);

  @Input() coupon: any;
  @Output() close = new EventEmitter();
  @Output() saved = new EventEmitter();

  form: any = {};

  ngOnInit() {
    this.form = this.coupon
      ? { ...this.coupon }
      : { is_active: true };
  }

  save() {
    const req = this.coupon
      ? this.api.update(this.coupon.id, this.form)
      : this.api.create(this.form);

    req.subscribe(() => this.saved.emit());
  }
}
 