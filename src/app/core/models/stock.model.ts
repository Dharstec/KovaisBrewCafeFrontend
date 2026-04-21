export interface StockItem {
  id: number;
  name: string;
  category_name: string;
  base_unit: string;
  unit_label: string;
  unit_value: number;
  current_qty: number;
  min_qty: number;
  is_low_stock: boolean;
  nearest_expiry: string | null;
  expiring_count: number;
  // local UI fields
  change_qty?: number | null;
  reason?: string;
}

export interface StockEntry {
  id: number;
  product_id: number;
  item_name: string;
  base_unit: string;
  qty: number;
  unit: string;
  base_qty: number;
  remaining_qty: number;
  purchase_price: number;
  purchase_date: string;
  expiry_date: string | null;
  supplier: string | null;
  batch_no: string | null;
  notes: string | null;
  created_at: string;
  days_to_expiry: number | null;
  expiry_status: 'NO_EXPIRY' | 'EXPIRED' | 'EXPIRING_TODAY' | 'EXPIRING_SOON' | 'OK';
}

export interface StockLog {
  id: number;
  product_id: number;
  item_name: string;
  change_qty: number;
  unit: string;
  action: 'STOCK_IN' | 'USAGE' | 'USAGE_RESERVED' | 'ADJUSTMENT' | 'WASTAGE' | 'RETURN' | 'DAILY_REFILL';
  reason: string | null;
  note: string | null;
  reference_id: number | null;
  stock_entry_id: number | null;
  created_at: string;
}

export interface BatchEntry {
  qty: number | null;
  purchase_price: number | null;
  expiry_date: string;
  batch_no: string;
  notes: string;
}

export interface StockAlerts {
  expiring: {
    id: number;
    item_name: string;
    base_unit: string;
    qty: number;
    unit: string;
    remaining_qty: number;
    expiry_date: string;
    supplier: string | null;
    batch_no: string | null;
    days_to_expiry: number;
    status: 'EXPIRED' | 'EXPIRING_TODAY' | 'EXPIRING_SOON' | 'EXPIRING_30';
  }[];
  low_stock: {
    id: number;
    name: string;
    base_unit: string;
    unit_label: string;
    current_qty: number;
    min_qty: number;
  }[];
  expiring_count: number;
  low_stock_count: number;
}
