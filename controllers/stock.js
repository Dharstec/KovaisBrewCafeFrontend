const DB = require("../middleware/dbFunctions");

exports.getStock = async (req, res) => {

  const data = await DB.PostgresAny(`
    SELECT
      p.id,
      p.name,
      c.name AS category_name,
      p.base_unit,
      p.unit_label,
      ROUND(p.unit_value)::INTEGER AS unit_value,
      ROUND(p.current_qty)::INTEGER AS current_qty,
      ROUND(p.min_qty)::INTEGER AS min_qty
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = true
      AND  (c.name = 'Stock Items' OR p.track_stock = true)
    ORDER BY p.name
  `, []);

  res.json(data);
};

exports.getDropDownStock = async (req, res) => {

  const data = await DB.PostgresAny(`
    SELECT
      p.id,
      p.name,
      c.name AS category_name,
      p.base_unit,
      p.unit_label,
      ROUND(p.unit_value)::INTEGER AS unit_value,
      ROUND(p.current_qty)::INTEGER AS current_qty,
      ROUND(p.min_qty)::INTEGER AS min_qty
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = true
    ORDER BY p.name
  `, []);

  res.json(data);
};

exports.adjustStock = async (req, res) => {
  try {
    const { product_id, change_qty, reason } = req.body;

    if (!product_id || !change_qty) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const result = await DB.PostgresAny(`
      UPDATE products
      SET current_qty = current_qty + $1,
          updated_at = NOW()
      WHERE id = $2
        AND track_stock = true
      RETURNING current_qty
    `, [change_qty, product_id]);

    if (!result.length) {
      return res.status(400).json({ message: "Stock item not found" });
    }

    /* OPTIONAL: keep history */
    await DB.PostgresInsert("stock_logs", {
      product_id,
      change_qty,
      reason: reason || 'MANUAL'
    });

    res.json({
      message: "Stock updated successfully",
      current_qty: result[0].current_qty
    });

  } catch (err) {
    console.error("Stock update error:", err);
    res.status(500).json({ message: "Stock update failed" });
  }
};
