export type PaymentMode = 'cash' | 'card' | 'upi' | 'credit' | 'other';
export type SalesInvoiceStatus = 'completed' | 'partially_returned' | 'returned' | 'cancelled';
export type TaxType = 'CGST_SGST' | 'IGST';

export interface SalesInvoiceItem {
  id: number;
  invoice_id: number;
  product_id: number;
  product_name: string;
  stock_item_id: number;
  hsn_sac_code: string;
  quantity: number | string;
  unit: string;
  rate: number | string;
  discount_percent: number | string;
  sale_price: number | string;
  gst_rate: number | string;
  gst_amount: number | string;
  line_amount: number | string;
  imei1: string | null;
  imei2: string | null;
  serial_no: string | null;
  warranty_years: number;
  warranty_months: number;
  status: 'active' | 'returned';
}

export interface SalesInvoice {
  id: number;
  invoice_no: string;
  financial_year: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_gstin: string | null;
  invoice_date: string;
  place_of_supply: string | null;
  tax_type: TaxType;
  taxable_amount: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  bill_discount_percent: number | string;
  bill_discount_amount: number | string;
  round_off: number | string;
  total_amount: number | string;
  payment_mode: PaymentMode;
  amount_paid: number | string;
  balance_due: number | string;
  /** How much cash the shop now owes back to the customer - only ever
   * nonzero after a return drops the recalculated total below what was
   * already paid (amount_paid itself is never rewritten by a return).
   * Computed fresh by the backend on every fetch, not stored. */
  refund_due?: number | string;
  status: SalesInvoiceStatus;
  items?: SalesInvoiceItem[];
}

export interface SalesItemInput {
  product_id: number;
  stock_item_id?: number;
  quantity?: number;
  rate?: number;
  discount_percent?: number;
  gst_rate?: number;
  warranty_years?: number;
  warranty_months?: number;
}

export interface SalesCreateInput {
  customer_id: number;
  invoice_date: string;
  payment_mode: PaymentMode;
  amount_paid?: number;
  bill_discount_percent?: number;
  items: SalesItemInput[];
}

/** Same shape as SalesCreateInput, minus amount_paid - editing an invoice
 * never touches amount_paid (that's managed only via the initial create()
 * seed and SalesService.recordPayment()); the server recomputes
 * balance_due against the possibly-changed total instead. See
 * SalesService::update() on the backend. */
export interface SalesUpdateInput {
  id: number;
  customer_id: number;
  invoice_date: string;
  payment_mode: PaymentMode;
  bill_discount_percent?: number;
  items: SalesItemInput[];
}

/** One row of an invoice's payment ledger - the initial counter payment
 * (if any, logged automatically at Checkout) plus every later payment
 * recorded against its balance_due via SalesService.recordPayment(). */
export interface PaymentHistoryEntry {
  id: number;
  invoice_id: number;
  amount: number | string;
  payment_mode: PaymentMode;
  note: string | null;
  received_at: string;
  created_by: number | null;
  received_by_name: string | null;
  created_at: string;
  /** present only from paymentHistoryByCustomer() - which invoice this row belongs to */
  invoice_no?: string;
  invoice_date?: string;
}

export interface RecordPaymentInput {
  invoice_id: number;
  amount: number;
  payment_mode?: PaymentMode;
  note?: string;
  received_at?: string;
}
