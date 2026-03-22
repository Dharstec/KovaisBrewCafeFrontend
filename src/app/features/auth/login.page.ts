import { Component, inject } from '@angular/core';
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
  router = inject(Router);

  step: 'login' | 'otp' = 'login';

  form = {
    email: '',
    password: '',
    otp: ''
  };

  loading = false;
  error = '';

  submit() {
    this.error = '';
    this.loading = true;

    const payload =
      this.step === 'login'
        ? { email: this.form.email, password: this.form.password }
        : { email: this.form.email, otp: this.form.otp };

    this.authApi.login(payload).subscribe({
      next: (res: any) => {
        this.loading = false;

        if (res.status === 'otp-required') {
          this.step = 'otp';
          return;
        }

        if (res.status === 'success') {
          this.authApi.saveSession(res.data);
          this.router.navigateByUrl('/billing');
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Login failed';
      }
    });
  }
}
