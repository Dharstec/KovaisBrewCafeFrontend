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
      STOCK SUMMARY (FIXED)
      =============================== */
    const stock = await DB.PostgresAny(`
        SELECT
          COUNT(*) AS total_items,
          COUNT(*) FILTER (
            WHERE current_qty <= min_qty AND current_qty > 0
          ) AS low_stock,
          COUNT(*) FILTER (
            WHERE current_qty <= 0
          ) AS out_of_stock
        FROM products
        WHERE track_stock = true
          AND is_active = true
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

exports.getHourlyItemSales = async (req, res) => {
  try {
    const data = await DB.PostgresAny(`
      SELECT
        p.name AS item_name,

        TO_CHAR(
          DATE_TRUNC('hour', b.created_at),
          'HH24:00'
        ) || ' - ' ||
        TO_CHAR(
          DATE_TRUNC('hour', b.created_at) + INTERVAL '1 hour',
          'HH24:00'
        ) AS time_range,

        SUM(bi.qty)::INT AS total_count

      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      JOIN products p ON p.id = bi.product_id

      WHERE
        b.created_at >= DATE_TRUNC('day', NOW())
        AND b.created_at <  DATE_TRUNC('day', NOW()) + INTERVAL '1 day'

      GROUP BY
        p.name,
        DATE_TRUNC('hour', b.created_at)

      ORDER BY
        DATE_TRUNC('hour', b.created_at)
    `);

    res.json(data);
  } catch (err) {
    console.error('Hourly sales failed:', err);
    res.status(500).json({ message: 'Hourly sales failed' });
  }
};





exports.getItemSalesChart = async (req, res) => {
  try {
    const data = await DB.PostgresAny(`
      SELECT
        p.name AS item_name,
        SUM(bi.qty) AS total_count
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      JOIN products p ON p.id = bi.product_id
      WHERE DATE(b.created_at) = CURRENT_DATE
      GROUP BY item_name
      ORDER BY total_count DESC
    `);

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Item chart failed" });
  }
};

