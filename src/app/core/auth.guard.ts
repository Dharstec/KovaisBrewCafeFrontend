import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthApi } from './api/auth.api';


/* ---------- AUTH GUARD ---------- */
export function authGuard() {
  const auth = inject(AuthApi);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
}

/* ---------- ADMIN GUARD ---------- */
export function adminGuard() {
  const auth = inject(AuthApi);
  const router = inject(Router);

  if (auth.isAdmin()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
}

