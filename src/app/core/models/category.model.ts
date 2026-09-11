export type AttributeType = 'text' | 'number' | 'select';

export interface CategoryAttribute {
  id: number;
  category_id: number;
  attribute_name: string;
  attribute_type: AttributeType;
  options: string[] | null;
  is_required: boolean | 0 | 1;
}

export interface Category {
  id: number;
  category_name: string;
  sub_category: string | null;
  is_imei_required: boolean | 0 | 1;
  is_serial_required: boolean | 0 | 1;
  size_type: 'Big' | 'Small' | null;
  attributes: CategoryAttribute[];
}
