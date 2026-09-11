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
  taxable_amount: number | string;
  gst: number | string;
  total_amount: number | string;
  status: 'completed' | 'partially_returned' | 'returned' | 'cancelled';
}

export interface SalesReport {
  rows: ReportRow[];
  summary: ReportSummary;
  invoices: SalesReportInvoiceRow[];
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
