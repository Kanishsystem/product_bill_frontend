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
  /** Current remaining quantity on this line's linked stock_items row - only
   * meaningful for a plain-quantity (non-serialized) batch line. Compared
   * against this row's own `quantity` (what was originally purchased) to
   * detect a PARTIAL draw-down (some, but not all, of the batch already
   * sold) - `stock_status` alone stays 'in_stock' in that case, so this is
   * what actually tells the purchase-edit screen a line is locked. See
   * PurchaseService::purchaseLineHasMoved(). */
  stock_quantity: number | string | null;
  /** True once ANY sales_invoice_items row has ever referenced this line's
   * stock_item, even one since fully returned - a sale return restores
   * stock_status/stock_quantity back to normal but never deletes the sale
   * record it created, so this is checked before (and regardless of)
   * stock_status/stock_quantity below. See
   * PurchaseService::purchaseLineHasMoved()'s doc comment. */
  has_sale_history: boolean | number | string;
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
  /** Update only: the purchase_item id this line was loaded from (a plain
   * quantity line), or `ids` for a legacy grouped multi-unit line (one id
   * per unit/serial, same order). Omitted entirely for a brand-new line
   * added during this edit - see PurchaseService::update(). Never sent on
   * create(). */
  id?: number;
  ids?: number[];
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
 * against the possibly-changed total instead. Per-line, not all-or-nothing:
 * a line whose stock already moved (sold/returned/damaged) must be resent
 * unchanged (its `id`/`ids` + identical fields) or the whole save is
 * rejected, but unmoved lines can be freely edited/removed and brand-new
 * lines (no `id`/`ids`) can always be added - see PurchaseService::update(). */
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
