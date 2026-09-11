export type TaxType = 'CGST_SGST' | 'IGST';
export type PurchaseStatus = 'recorded' | 'cancelled';
export type PurchasePaymentMode = 'cash' | 'card' | 'upi' | 'credit' | 'other';

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
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
  stock_item_id: number | null;
  stock_status: 'in_stock' | 'sold' | 'returned' | 'damaged' | null;
}

export interface Purchase {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_invoice_no: string;
  purchase_date: string;
  place_of_supply: string | null;
  tax_type: TaxType;
  taxable_amount: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  round_off: number | string;
  total_amount: number | string;
  payment_mode: PurchasePaymentMode;
  amount_paid: number | string;
  balance_due: number | string;
  status: PurchaseStatus;
  items?: PurchaseItem[];
}

/** One physical unit for an IMEI-required line (Mobile category). */
export interface PurchaseUnitInput {
  imei1: string;
  imei2?: string;
}

export interface PurchaseItemInput {
  product_id: number;
  rate: number;
  discount_percent?: number;
  gst_rate?: number;
  hsn_sac_code?: string;
  unit?: string;
  units?: PurchaseUnitInput[];
  serials?: string[];
  quantity?: number;
}

export interface PurchaseCreateInput {
  supplier_id: number;
  supplier_invoice_no: string;
  purchase_date: string;
  payment_mode?: PurchasePaymentMode;
  amount_paid?: number;
  items: PurchaseItemInput[];
}

/** Same shape as PurchaseCreateInput, minus amount_paid - editing a purchase
 * never touches amount_paid (managed only via the initial create() seed and
 * PurchaseService.recordPayment()); the server recomputes balance_due
 * against the possibly-changed total instead. Blocked server-side if any
 * unit this purchase brought into stock has already been sold/returned/
 * damaged - see PurchaseService::update(). */
export interface PurchaseUpdateInput {
  id: number;
  supplier_id: number;
  supplier_invoice_no: string;
  purchase_date: string;
  payment_mode?: PurchasePaymentMode;
  items: PurchaseItemInput[];
}

/** One row of a purchase's payment ledger - the initial counter payment
 * (if any, logged automatically at purchase entry) plus every later payment
 * recorded against its balance_due via PurchaseService.recordPayment(). */
export interface PurchasePaymentHistoryEntry {
  id: number;
  purchase_id: number;
  amount: number | string;
  payment_mode: PurchasePaymentMode;
  note: string | null;
  paid_at: string;
  created_by: number | null;
  paid_by_name: string | null;
  created_at: string;
  /** present only from paymentHistoryBySupplier() - which purchase this row belongs to */
  supplier_invoice_no?: string;
  purchase_date?: string;
}

export interface RecordPurchasePaymentInput {
  purchase_id: number;
  amount: number;
  payment_mode?: PurchasePaymentMode;
  note?: string;
  paid_at?: string;
}
