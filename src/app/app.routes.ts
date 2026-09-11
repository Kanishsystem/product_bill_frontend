import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/admin-shell/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/list/categories-list').then((m) => m.CategoriesList),
      },
      {
        path: 'categories/new',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/categories/form/category-form').then((m) => m.CategoryForm),
      },
      {
        path: 'categories/:id/edit',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/categories/form/category-form').then((m) => m.CategoryForm),
      },
      {
        path: 'brands',
        loadComponent: () => import('./features/brands/list/brands-list').then((m) => m.BrandsList),
      },
      {
        path: 'brands/new',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/brands/form/brand-form').then((m) => m.BrandForm),
      },
      {
        path: 'brands/:id/edit',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/brands/form/brand-form').then((m) => m.BrandForm),
      },
      {
        path: 'units',
        loadComponent: () => import('./features/units/list/units-list').then((m) => m.UnitsList),
      },
      {
        path: 'units/new',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/units/form/unit-form').then((m) => m.UnitForm),
      },
      {
        path: 'units/:id/edit',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/units/form/unit-form').then((m) => m.UnitForm),
      },
      {
        path: 'products',
        loadComponent: () => import('./features/products/list/products-list').then((m) => m.ProductsList),
      },
      {
        path: 'products/new',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/products/form/product-form').then((m) => m.ProductForm),
      },
      {
        path: 'products/:id/edit',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/products/form/product-form').then((m) => m.ProductForm),
      },
      {
        path: 'parties',
        loadComponent: () => import('./features/parties/list/parties-list').then((m) => m.PartiesList),
      },
      {
        path: 'parties/new',
        loadComponent: () => import('./features/parties/form/party-form').then((m) => m.PartyForm),
      },
      {
        path: 'parties/:id',
        loadComponent: () => import('./features/parties/detail/party-detail').then((m) => m.PartyDetail),
      },
      {
        path: 'parties/:id/edit',
        loadComponent: () => import('./features/parties/form/party-form').then((m) => m.PartyForm),
      },
      {
        path: 'settings',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/company-profile/company-profile').then((m) => m.CompanyProfileComponent),
      },
      {
        path: 'purchases',
        loadComponent: () => import('./features/purchases/list/purchases-list').then((m) => m.PurchasesList),
      },
      {
        path: 'purchases/new',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/purchases/form/purchase-form').then((m) => m.PurchaseForm),
      },
      {
        path: 'purchases/:id/edit',
        canActivate: [roleGuard(['admin', 'inventory_manager'])],
        loadComponent: () => import('./features/purchases/form/purchase-form').then((m) => m.PurchaseForm),
      },
      {
        path: 'purchases/:id',
        loadComponent: () => import('./features/purchases/detail/purchase-detail').then((m) => m.PurchaseDetail),
      },
      {
        path: 'stock',
        loadComponent: () => import('./features/stock/ledger/stock-ledger').then((m) => m.StockLedger),
      },
      {
        path: 'sales',
        loadComponent: () => import('./features/sales/list/sales-list').then((m) => m.SalesList),
      },
      {
        path: 'sales/new',
        canActivate: [roleGuard(['admin', 'cashier'])],
        loadComponent: () => import('./features/sales/billing/billing').then((m) => m.Billing),
      },
      {
        path: 'sales/:id/edit',
        canActivate: [roleGuard(['admin', 'cashier'])],
        loadComponent: () => import('./features/sales/billing/billing').then((m) => m.Billing),
      },
      {
        path: 'sales/:id',
        loadComponent: () => import('./features/sales/detail/sale-detail').then((m) => m.SaleDetail),
      },
      {
        path: 'payments',
        loadComponent: () => import('./features/payments/list/payments-list').then((m) => m.PaymentsList),
      },
      {
        path: 'reports',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'users',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/users/list/users-list').then((m) => m.UsersList),
      },
      {
        path: 'users/new',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/users/form/user-form').then((m) => m.UserForm),
      },
      {
        path: 'users/:id/edit',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/users/form/user-form').then((m) => m.UserForm),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
