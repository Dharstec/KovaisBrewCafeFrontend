import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.page')
        .then(m => m.LoginPage)
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.page')
        .then(m => m.DashboardPage)
  },

  {
    path: 'billing',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/billing/billing.page')
        .then(m => m.BillingPage)
  },

  {
    path: 'pending',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pending/pending.page')
        .then(m => m.PendingPage)
  },

  {
    path: 'completed',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/completed/completed.page')
        .then(m => m.CompletedPage)
  },

  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/products/products.page')
        .then(m => m.ProductsPage)
  },

  /* 🔒 ADMIN ONLY */
  {
    path: 'attendance',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/attendance/attendance.page')
        .then(m => m.AttendancePage)
  },

  {
    path: 'advance',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/advance/employee-advance.page')
        .then(m => m.EmployeeAdvancePage)
  },
  {
    path: 'stock',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/stock/stock.page')
        .then(m => m.StockPage)
  },
  {
    path: 'stock-count',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/stock/stock-count.page')
        .then(m => m.StockCountPage)
  },
  {
    path: 'coupons',
    loadComponent: () =>
      import('./features/coupon/coupon-list.page')
        .then(m => m.CouponListPage)
  },
  {
    path: 'expenses',
    loadComponent: () =>
      import('./features/spendPage/spend.page')
        .then(m => m.SpendPage)
  },

  /* 📊 REPORTS — Admin only */
  {
    path: 'reports',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/reports/reports.page')
        .then(m => m.ReportsPage)
  },

  /* 📲 WHATSAPP SETUP — Admin only */
  {
    path: 'whatsapp-setup',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/whatsapp/whatsapp-setup.page')
        .then(m => m.WhatsappSetupPage)
  },

  /* 👥 EMPLOYEES — Admin only */
  {
    path: 'employees',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/employees/employees.page')
        .then(m => m.EmployeesPage)
  },

  /* 🎯 BUSINESS TARGETS — Admin only */
  {
    path: 'targets',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/targets/targets.page')
        .then(m => m.TargetsPage)
  },

  /* 💰 SALARY — Admin only */
  {
    path: 'salary',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/salary/salary.page')
        .then(m => m.SalaryPage)
  }

];
