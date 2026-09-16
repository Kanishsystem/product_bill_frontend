// 'cash_in_hand' is tracked as its own distinct mode (not just an alias of
// 'cash') - useful for a shop that reconciles cash collected by hand
// separately from register cash. 'emi' records exactly one extra figure on
// the invoice (SalesInvoice.emi_amount, the recurring installment amount) -
// there's no installment schedule/due-dates/tracking beyond that; see
// SalesService's class doc comment on the backend. 'gpay' is its own
// distinct mode too, not an alias of 'upi'.
//
// As of iteration log item 59, Billing only offers cash/card/upi/emi/gpay
// for a NEW bill (credit/other/cash_in_hand stay in this union, and stay
// fully supported for reading/editing/printing/reporting, purely because
// an older invoice may already have been saved with one of them).
//
// 'split' (iteration log item 62) is one bill paid across more than one of
// cash/upi/card/gpay at once (e.g. Cash 5000 + Gpay 5000 + Card 5000 for a
// 15000 bill) - see SalesCreateInput.split_payments and
// SalesInvoice.split_payments. Only offered when creating a NEW bill (same
// as every mode listed here except the three retired ones above); EMI is
// deliberately never one of a split's components - choosing EMI stays a
// single whole-bill mode of its own.
export type PaymentMode = 'cash' | 'card' | 'upi' | 'credit' | 'other' | 'cash_in_hand' | 'emi' | 'gpay' | 'split';

/** One component of a split payment - see PaymentMode's 'split' doc comment.
 * `mode` is always one of cash/upi/card/gpay (never 'emi' or 'split'
 * itself - enforced server-side by SalesController's
 * SPLIT_COMPONENT_PAYMENT_MODES allowlist). */
export interface SplitPaymentInput {
  mode: PaymentMode;
  amount: number;
}
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
  /** Only ever set when payment_mode is 'emi' - the recurring installment
   * figure, for reference/printing only (no schedule/due-dates/tracking -
   * see SalesService's class doc comment). Null for every other mode. */
  emi_amount: number | string | null;
  amount_paid: number | string;
  balance_due: number | string;
  /** How much cash the shop now owes back to the customer - only ever
   * nonzero after a return drops the recalculated total below what was
   * already paid (amount_paid itself is never rewritten by a return).
   * Computed fresh by the backend on every fetch, not stored. */
  refund_due?: number | string;
  status: SalesInvoiceStatus;
  items?: SalesInvoiceItem[];
  /** Only ever present when payment_mode is 'split' - the components this
   * bill was actually paid with (e.g. [{payment_mode:'cash',amount:5000},
   * {payment_mode:'gpay',amount:5000},{payment_mode:'card',amount:5000}]),
   * read back from payment_history's "Recorded at time of sale" rows (see
   * SalesService::get()). Undefined/absent for every other payment_mode. */
  split_payments?: { payment_mode: PaymentMode; amount: number | string }[];
}

export interface SalesItemInput {
  product_id: number;
  /** Legacy path only - a cart line built from a scanned/looked-up existing
   * serialized stock unit still sends this (see Billing.lookupScan()). A
   * fresh IMEI/Serial-required line now sends imei1/imei2/serial_no instead
   * and is allocated against batch stock server-side - see
   * SalesService::buildAllocationRows(). */
  stock_item_id?: number;
  /** Manually typed at the point of sale for an IMEI/Serial-required
   * product - see SalesService::buildAllocationRows(). */
  imei1?: string;
  imei2?: string;
  serial_no?: string;
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
  /** Required by the server when payment_mode is 'emi' - see
   * SalesController::validateCreate(). Ignored otherwise. */
  emi_amount?: number;
  /** Required (at least 2 entries) when payment_mode is 'split' - see
   * SalesController::validateCreate() and PaymentMode's 'split' doc comment.
   * Ignored otherwise; only ever sent when creating a NEW bill, never on an
   * update (see SalesUpdateInput - editing never resends/changes a split's
   * breakdown, same rule as amount_paid itself). */
  split_payments?: SplitPaymentInput[];
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
  /** Required by the server when payment_mode is 'emi' - see
   * SalesController::validateCreate() (validateUpdate() reuses it). Ignored
   * otherwise. */
  emi_amount?: number;
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
