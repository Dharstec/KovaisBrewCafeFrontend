const DB = require("../middleware/dbFunctions");

/* ================= CURRENT STOCK ================= */
exports.getStock = async (req, res) => {
  const data = await DB.PostgresAny(`
    SELECT
      p.id,
      p.name,
      p.unit_label,
      p.unit_value,
      p.base_unit,
      COALESCE(ps.current_qty, 0) AS stock_qty,
      ps.min_qty
    FROM products p
    LEFT JOIN product_stock ps ON ps.product_id = p.id
    ORDER BY p.name
  `);

  res.json(data);
};

/* ================= ADD / REDUCE STOCK ================= */
exports.adjustStock = async (req, res) => {
  try {
    const { product_id, change_qty, reason } = req.body;

    if (!product_id || !change_qty || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await DB.PostgresAny(
      `
      UPDATE product_stock
      SET current_qty = current_qty + $1,
          updated_at = NOW()
      WHERE product_id = $2
      RETURNING current_qty
      `,
      [change_qty, product_id]
    );

    if (!result.length) {
      throw new Error("Product stock not found");
    }

    if (result[0].current_qty < 0) {
      throw new Error("Stock cannot be negative");
    }

    await DB.PostgresAny(
      `
      INSERT INTO stock_logs
        (product_id, change_qty, reason, ref_type)
      VALUES ($1, $2, $3, 'MANUAL')
      `,
      [product_id, change_qty, reason]
    );

    res.json({ message: "Stock updated successfully" });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

