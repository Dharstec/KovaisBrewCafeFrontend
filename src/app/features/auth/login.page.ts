import { Component, inject, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApi } from '../../core/api/auth.api';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {

  authApi = inject(AuthApi);
  router  = inject(Router);
  cdr     = inject(ChangeDetectorRef);

  @ViewChild('otpInput') otpInputRef!: ElementRef<HTMLInputElement>;

  step: 'login' | 'otp' = 'login';

  form = { email: '', password: '', otp: '' };

  showPassword = false;
  loading      = false;
  error        = '';
  emailFocus   = false;
  passFocus    = false;

  /* ── OTP: single string, 6 digits ── */
  otpValue = '';

  get otpDigits(): string[] {
    return Array.from({ length: 6 }, (_, i) => this.otpValue[i] || '');
  }

  get activeOtpIndex(): number {
    return Math.min(this.otpValue.length, 5);
  }

  focusOtp() {
    setTimeout(() => this.otpInputRef?.nativeElement.focus(), 50);
  }

  onOtpChange() {
    const clean = this.otpValue.replace(/\D/g, '').slice(0, 6);
    this.otpValue  = clean;
    this.form.otp  = clean;
    // sync the DOM input value
    if (this.otpInputRef) {
      this.otpInputRef.nativeElement.value = clean;
    }
    this.cdr.detectChanges();
    if (clean.length === 6) {
      setTimeout(() => this.submit(), 120);
    }
  }

  /* ── LOGIN + OTP submit ── */
  submit() {
    this.error   = '';
    this.loading = true;

    const payload =
      this.step === 'login'
        ? { email: this.form.email, password: this.form.password }
        : { email: this.form.email, otp: this.form.otp };

    this.authApi.login(payload).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.status === 'otp-required') {
          this.step     = 'otp';
          this.otpValue = '';
          this.form.otp = '';
          this.cdr.detectChanges();
          setTimeout(() => this.otpInputRef?.nativeElement.focus(), 150);
          return;
        }
        if (res.status === 'success') {
          this.authApi.saveSession(res.data);
          this.router.navigateByUrl('/billing');
        }
      },
      error: (err) => {
        this.loading  = false;
        this.otpValue = '';
        this.form.otp = '';
        this.error    = err.error?.message || 'Login failed. Please try again.';
      }
    });
  }
}
