export interface DashboardSummary {
  today_sales:   number;
  today_bills:   number;
  cash_total:    number;
  upi_total:     number;
  pending_bills: number;

  products:   number;
  categories: number;
  employees:  number;

  attendance: {
    present: number;
    absent:  number;
  };

  stock: {
    total_items:  number;
    low_stock:    number;
    out_of_stock: number;
  };
}
