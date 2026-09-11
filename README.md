# Product Billing Frontend

Angular admin/billing UI for RASI TIME CENTER MOBILES & HOME APPLIANCES.

Angular 22, standalone components (no NgModules), signals for local/service
state, lazy-loaded routes via `loadComponent` - same architectural pattern
as the `viji-insurance-admin` reference project. Plain SCSS with a
CSS-variable design system (no Angular Material / PrimeNG), `sweetalert2`
for toasts and confirm dialogs. No charting library - the dashboard's charts
are dependency-free CSS bars.

## Setup

1. `npm install`
2. Point `src/environments/environment.ts` at your backend
   (`product_bill_backend`) URL - defaults to
   `http://localhost/product_bill_backend` for an XAMPP/Apache setup.
3. `npm start` (`ng serve`) for local dev, or `npm run build` for a
   production build (output in `dist/`).

Default login (after the backend's `user_seeder.php` has run):
`admin@productbill.local` / see that script's console output for the
generated password. Create additional staff logins from the **Users**
screen once signed in as Admin.

## Structure

- `core/` - `api.service` (thin HTTP wrapper), `auth.service` (session-storage
  token + signals), `jwt.interceptor`, `auth.guard` / `role.guard`, one
  service + model per backend resource (`company`, `category`, `product`,
  `party`, `purchase`, `stock-item`, `sale`, `report`, `user`).
- `shared/components/` - `icon` (inline-SVG icon set, no icon font/library),
  `empty-state`.
- `features/` - one folder per screen:
  - `auth/login`, `shell/admin-shell` (collapsible sidebar on desktop,
    bottom nav on mobile)
  - `dashboard` - metric cards + CSS bar charts, wired to `reports/dashboard`
  - `settings/company-profile`, `categories`, `products`, `parties`
  - `purchases/{list,form,detail}` - purchase entry with a dynamic
    IMEI-units / serials / quantity editor per line, driven by the selected
    product's category
  - `stock/ledger` - Summary + Ledger tabs, plus a standalone IMEI/Serial
    lookup box
  - `sales/{billing,list,detail}` - the mobile-first billing screen (scan
    box, product search with an in-stock unit picker, cart, payment,
    sticky Generate Invoice bar), invoice list, and invoice detail (tax
    breakup, browser print view, per-item returns)
  - `reports` - tabbed Sales / Purchases / Stock Valuation / Profit / GST
    reports with date-range filters
  - `users/{list,form}` - staff account management, role assignment

## Notes

- The Product form renders its "dynamic attributes" section (RAM/Storage/
  Color, Capacity/Power, Type/Color, ...) from whatever attributes are
  defined on the selected category - add/edit those from the Category
  Master screen first.
- The billing screen's scan box expects a keyboard-wedge USB/Bluetooth
  barcode scanner or manual typing (it just submits whatever's typed to
  `stock/lookup`) - there's no camera-based scanning yet.
- The invoice detail screen's **Print** button uses the browser's native
  print-to-PDF - a server-generated PDF (dompdf) isn't wired up on the
  backend yet; see that project's README.
- Role-based UI: routes are guarded client-side with `roleGuard` matching
  the backend's role checks (Admin: everything; Cashier: billing + read-only
  stock; Inventory Manager: purchases + stock, no billing) - but the backend
  is what actually enforces this, the frontend guard is just to avoid
  showing screens a role can't use.
- Angular CLI 22.1.x's own Node.js version check requires a patch release
  this environment didn't have available when this project was scaffolded
  (`^22.22.3` vs the installed `22.22.2`) - if `ng serve`/`ng build` refuse to
  run with a Node version error on a machine that's otherwise on Node 22.22.x,
  either bump to 22.22.3+ or edit the two-character version string in
  `node_modules/@angular/cli/src/utilities/node-version.js` (and
  `node_modules/@angular/build/src/tools/esbuild/target.js`) the same way.
"# product_bill_frontend" 
