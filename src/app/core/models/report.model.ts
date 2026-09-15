export interface DashboardTopProduct {
  product_id: number;
  product_name: string;
  qty_sold: number | string;
  revenue: number | string;
}

export interface DashboardCategoryRevenue {
  category_name: string;
  revenue: number | string;
}

export interface DashboardSalesTrendPoint {
  invoice_date: string;
  total: number | string;
}

export interface DashboardData {
  today_sales: number;
  pending_payments: number;
  low_stock_count: number;
  top_products: DashboardTopProduct[];
  category_revenue: DashboardCategoryRevenue[];
  sales_trend: DashboardSalesTrendPoint[];
}

export type SalesReportGroupBy = 'day' | 'month' | 'category';

export interface ReportRow {
  period: string;
  invoice_count?: number;
  qty?: number | string;
  taxable: number | string;
  gst: number | string;
  total: number | string;
}

export interface ReportSummary {
  invoice_count: number;
  taxable: number | string;
  gst: number | string;
  total: number | string;
}

export interface SalesReportInvoiceRow {
  id: number;
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  /** Empty string (never null) when the customer party has no phone on file
   * - see ReportService::salesReport()'s COALESCE. */
  customer_phone: string;
  taxable_amount: number | string;
  gst: number | string;
  total_amount: number | string;
  status: 'completed' | 'partially_returned' | 'returned' | 'cancelled';
  /** Lets this same "all invoices" table also answer "which invoice number is
   * EMI/Cash/etc." - see PaymentModeReportRow for the aggregated totals. */
  payment_mode: string;
  /** Only ever non-null when payment_mode is 'emi' - see
   * SalesInvoice.emi_amount's doc comment. */
  emi_amount: number | string | null;
}

/** One row per distinct payment_mode within the report's date range - this is
 * where "how much came in as cash" and "how much is sitting in EMI amounts"
 * are answered. `collected` is amount_paid actually received for that mode;
 * `emi_amount` is only ever non-zero for the 'emi' row (the column itself is
 * null for every other mode - see SalesInvoice.emi_amount's doc comment). */
export interface PaymentModeReportRow {
  payment_mode: string;
  invoice_count: number;
  total: number | string;
  collected: number | string;
  balance_due: number | string;
  emi_amount: number | string;
}

export interface SalesReport {
  rows: ReportRow[];
  summary: ReportSummary;
  invoices: SalesReportInvoiceRow[];
  payment_modes: PaymentModeReportRow[];
  group_by: SalesReportGroupBy;
  from_date: string;
  to_date: string;
}

export interface PurchaseReportRow {
  id: number;
  purchase_date: string;
  supplier_invoice_no: string;
  supplier_name: string;
  tax_type: string;
  taxable_amount: number | string;
  gst: number | string;
  total_amount: number | string;
}

export interface PurchaseReport {
  rows: PurchaseReportRow[];
  summary: {
    purchase_count: number;
    taxable: number | string;
    gst: number | string;
    total: number | string;
  };
  from_date: string;
  to_date: string;
}

export interface StockValuationRow {
  product_id: number;
  product_name: string;
  category_name: string;
  on_hand: number | string;
  stock_value: number | string;
}

export interface StockValuationReport {
  rows: StockValuationRow[];
  total_value: number;
}

export interface ProfitReportRow {
  product_id: number;
  product_name: string;
  qty_sold: number | string;
  revenue: number | string;
  cost: number | string;
  profit: number | string;
}

export interface ProfitReport {
  rows: ProfitReportRow[];
  summary: { revenue: number; cost: number; profit: number };
  from_date: string;
  to_date: string;
}

export interface GstSide {
  taxable: number | string;
  cgst: number | string;
  sgst: number | string;
  igst: number | string;
  total_gst: number | string;
}

export interface GstReport {
  output: GstSide;
  input: GstSide;
  net_payable: number;
  from_date: string;
  to_date: string;
}
