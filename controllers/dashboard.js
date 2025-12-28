const DB = require("../middleware/dbFunctions");

exports.getDashboardSummary = async (req, res) => {
  try {

    /* ===============================
       SALES & BILLING (TODAY)
       =============================== */
    const sales = await DB.PostgresAny(`
      SELECT 
        COUNT(*) AS total_bills,
        COALESCE(SUM(grand_total), 0) AS total_sales
      FROM bills
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    const pendingBills = await DB.PostgresAny(`
      SELECT COUNT(*) AS pending
      FROM bills
      WHERE status = 'PENDING'
    `);

    /* ===============================
       MASTER COUNTS
       =============================== */
    const products = await DB.PostgresAny(`
      SELECT COUNT(*) FROM products WHERE is_active = true
    `);

    const categories = await DB.PostgresAny(`
      SELECT COUNT(*) FROM categories WHERE status = true
    `);

    const employees = await DB.PostgresAny(`
      SELECT COUNT(*) FROM employees WHERE is_active = true
    `);

    /* ===============================
       ATTENDANCE (TODAY)
       =============================== */
    const attendance = await DB.PostgresAny(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'P') AS present,
        COUNT(*) FILTER (WHERE status = 'A') AS absent
      FROM attendance
      WHERE date = CURRENT_DATE
    `);

    /* ===============================
       STOCK SUMMARY (IMPORTANT)
       =============================== */
    const stock = await DB.PostgresAny(`
      SELECT
        COUNT(*) AS total_items,
        COUNT(*) FILTER (WHERE ps.current_qty <= ps.min_qty AND ps.current_qty > 0) AS low_stock,
        COUNT(*) FILTER (WHERE ps.current_qty <= 0) AS out_of_stock
      FROM product_stock ps
    `);

    res.json({
      today_sales: Number(sales[0].total_sales),
      today_bills: Number(sales[0].total_bills),
      pending_bills: Number(pendingBills[0].pending),

      products: Number(products[0].count),
      categories: Number(categories[0].count),
      employees: Number(employees[0].count),

      attendance: {
        present: Number(attendance[0].present),
        absent: Number(attendance[0].absent)
      },

      stock: {
        total_items: Number(stock[0].total_items),
        low_stock: Number(stock[0].low_stock),
        out_of_stock: Number(stock[0].out_of_stock)
      }
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Dashboard load failed" });
  }
};
