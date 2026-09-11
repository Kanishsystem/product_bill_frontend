export interface Product {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  is_imei_required?: boolean;
  is_serial_required?: boolean;
  size_type?: 'Big' | 'Small' | null;
  /** @deprecated legacy free-text column, kept on the row for old data but no
   * longer written to - use brand_id/brand_name (backed by the brands master
   * list) instead. */
  brand: string | null;
  brand_id: number | null;
  brand_name?: string | null;
  base_price: number | string;
  selling_price: number | string;
  tax_rate: number | string;
  hsn_sac_code: string;
  barcode: string | null;
  /** @deprecated legacy free-text column - use unit_id/unit_name (backed by
   * the units master list) instead. */
  unit: string;
  unit_id: number | null;
  unit_name?: string | null;
  attributes: Record<string, string>;
  status: 'active' | 'inactive';
  /** Current available quantity (sum of still-in-stock stock_items rows -
   * individual serialized units each count as 1, batch-tracked products sum
   * their remaining batch quantities) - same figure Stock > Summary shows,
   * included on every product row so screens like Billing's product search
   * can show it without a second lookup. */
  on_hand?: number;
}
