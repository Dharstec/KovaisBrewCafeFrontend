const DB = require("../middleware/dbFunctions");

exports.getDashboardSummary = async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        /* ===============================
           SALES & BILLING
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
            }
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({ message: "Dashboard load failed" });
    }
};
