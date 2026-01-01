const DB = require("../middleware/dbFunctions");

/* =========================================================
   GET RECIPE BY SALE PRODUCT
   ========================================================= */
exports.getRecipeByProduct = async (req, res) => {
  try {
    const { sale_product_id } = req.params;

    const data = await DB.PostgresAny(`
      SELECT
        pr.id,
        pr.raw_product_id,
        rp.name AS raw_name,
        pr.used_qty,
        rp.base_unit
      FROM product_recipes pr
      JOIN products rp ON rp.id = pr.raw_product_id
      WHERE pr.sale_product_id = $1
    `, [sale_product_id]);

    res.json(data);
  } catch (err) {
    console.error("Get recipe error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* =========================================================
   SAVE / UPDATE PRODUCT RECIPE
   ========================================================= */
exports.saveRecipe = async (req, res) => {
  try {
    const { sale_product_id, items } = req.body;

    if (!sale_product_id || !Array.isArray(items)) {
      return res.status(400).json({ msg: "Invalid payload" });
    }

    await DB.PostgresAny(
      `DELETE FROM product_recipes WHERE sale_product_id = $1`,
      [sale_product_id]
    );

    for (const item of items) {
      if (!item.raw_product_id || !item.used_qty) continue;

      await DB.PostgresInsert("product_recipes", {
        sale_product_id,
        raw_product_id: item.raw_product_id,
        used_qty: Number(item.used_qty)
      });
    }

    res.json({ success: true, message: "Recipe saved successfully" });

  } catch (err) {
    console.error("Save recipe error:", err);
    res.status(500).json({ msg: "Save failed" });
  }
};

/* =========================================================
   DELETE SINGLE RECIPE ROW
   ========================================================= */
exports.deleteRecipe = async (req, res) => {
  try {
    await DB.PostgresAny(
      `DELETE FROM product_recipes WHERE id = $1`,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Delete recipe error:", err);
    res.status(500).json({ msg: "Delete failed" });
  }
};
