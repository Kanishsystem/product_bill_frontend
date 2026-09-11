export type StockStatus = 'in_stock' | 'sold' | 'returned' | 'damaged';

export interface StockItem {
  id: number;
  product_id: number;
  product_name: string;
  brand: string | null;
  category_id: number;
  category_name: string;
  imei1: string | null;
  imei2: string | null;
  serial_no: string | null;
  batch_no: string | null;
  quantity: number | string;
  purchase_price: number | string;
  selling_price: number | string;
  status: StockStatus;
  purchase_id: number | null;
  purchase_item_id: number | null;
  created_at: string;
}

export interface StockSummaryRow {
  product_id: number;
  product_name: string;
  brand: string | null;
  unit: string;
  low_stock_threshold: number;
  category_name: string;
  is_imei_required: boolean | number;
  is_serial_required: boolean | number;
  on_hand: number;
  is_low_stock: boolean;
}
