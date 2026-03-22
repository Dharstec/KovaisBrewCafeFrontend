export interface StockItem {
  id: number;
  name: string;

  // stock
  stock_qty: number;   // base unit quantity (ml / gram / pcs)
  min_qty: number;

  // unit handling
  base_unit: 'ml' | 'gram' | 'pcs';
  unit_label?: string;   // litre / kg / packet
  unit_value?: number;   // 1000 / 1

  // optional (future use)
  is_active?: boolean;
}
