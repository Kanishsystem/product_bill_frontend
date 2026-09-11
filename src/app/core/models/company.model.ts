export interface CompanyProfile {
  id: number;
  shop_name: string;
  address: string | null;
  phone: string | null;
  gstin: string;
  home_state_code: string;
  invoice_prefix: string;
  theme_color: string;
  /** Path (relative to the backend, e.g. "uploads/company/header_xxx.png")
   * to an uploaded banner/logo image that replaces the plain shop
   * name/address text on the printed Tax Invoice - null when none has been
   * uploaded, in which case the invoice falls back to shop_name/address. */
  header_image_path: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  ifsc_code: string | null;
  terms_and_conditions: string | null;
  default_warranty_text: string | null;
}
