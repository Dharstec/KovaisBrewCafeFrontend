const DB = require("../middleware/dbFunctions");

/* =========================================================
   BILLING PRODUCT LIST (SELLABLE ONLY)
   ========================================================= */
exports.getAllProductsBilling = async (req, res) => {
  try {
    const { search, category_id } = req.query;

    let query = `
      SELECT
        p.id,
        p.name,
        p.price,
        p.image_url,
        p.category_id,
        p.is_manual_price,
        c.name AS category
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = true
        AND p.is_sellable = true`;

    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND LOWER(p.name) LIKE $${params.length}`;
    }

    if (category_id) {
      params.push(category_id);
      query += ` AND p.category_id = $${params.length}`;
    }

    query += ` ORDER BY p.name ASC`;

    const products = await DB.PostgresAny(query, params);
    res.json(products);

  } catch (err) {
    console.error("Billing products error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};


/* =========================================================
   GET ALL PRODUCTS (ADMIN PAGE)
   ========================================================= */
exports.getAllProducts = async (req, res) => {
  try {
    const { search = '', category_id, page = 1, limit = 10 } = req.query;

    const pageNo = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNo - 1) * pageSize;

    let where = `WHERE p.is_active = true`;
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND LOWER(p.name) LIKE $${params.length}`;
    }

    if (category_id) {
      params.push(category_id);
      where += ` AND p.category_id = $${params.length}`;
    }

    const dataQuery = `
      SELECT
        p.id,
        p.name,
        p.price,
        p.image_url,
        p.category_id,
        p.is_sellable,
        p.track_stock,
        p.current_qty,
        p.min_qty,
        p.base_unit,
        p.unit_label,
        p.unit_value,
        p.is_manual_price,
        p.is_active,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.name
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM products p
      ${where}
    `;

    const products = await DB.PostgresAny(
      dataQuery,
      [...params, pageSize, offset]
    );

    const count = await DB.PostgresAny(countQuery, params);
    const total = Number(count[0].total);

    res.json({
      data: products,
      page: pageNo,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    });

  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* =========================================================
   GET PRODUCT BY ID
   ========================================================= */
exports.getProductById = async (req, res) => {
  try {
    const data = await DB.PostgresAny(
      `SELECT * FROM products WHERE id = $1`,
      [Number(req.params.id)]
    );

    if (!data.length) {
      return res.status(404).json({ msg: "Not found" });
    }

    res.json(data[0]);

  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* =========================================================
   CREATE PRODUCT
   ========================================================= */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      category_id,
      image_url,

      is_sellable = true,
      track_stock = false,

      current_qty,
      min_qty,
      base_unit,
      unit_label,
      unit_value,

      is_manual_price = false
    } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ msg: "Name & category required" });
    }

    if (is_sellable && !is_manual_price && price === undefined) {
      return res.status(400).json({ msg: "Price required" });
    }

    const payload = {
      name,
      category_id,
      image_url: image_url || null,

      is_sellable: !!is_sellable,
      track_stock: !!track_stock,

      price: is_manual_price ? 0 : Number(price),
      is_manual_price: !!is_manual_price,
      is_active: true
    };

    // ✅ ADD STOCK FIELDS ONLY IF track_stock = true
    if (track_stock) {
      payload.current_qty = Number(current_qty) || 0;
      payload.min_qty = Number(min_qty) || 0;
      payload.base_unit = base_unit || 'pcs';
      payload.unit_label = unit_label || 'piece';
      payload.unit_value = Number(unit_value) || 1;
    }

    const product = await DB.PostgresInsert("products", payload);
    res.status(201).json({ success: true, product });

  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ msg: "Create failed" });
  }
};

/* =========================================================
   UPDATE PRODUCT
   ========================================================= */
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      category_id,
      image_url,

      is_sellable,
      track_stock,

      current_qty,
      min_qty,
      base_unit,
      unit_label,
      unit_value,

      is_manual_price,
      is_active
    } = req.body;

    const payload = {
      name,
      category_id,
      image_url,

      is_sellable: !!is_sellable,
      track_stock: !!track_stock,

      price: is_manual_price ? 0 : Number(price),
      is_manual_price: !!is_manual_price,
      is_active: !!is_active
    };

    if (track_stock) {
      payload.current_qty = Number(current_qty) || 0;
      payload.min_qty = Number(min_qty) || 0;
      payload.base_unit = base_unit;
      payload.unit_label = unit_label;
      payload.unit_value = Number(unit_value) || 1;
    } else {
      payload.current_qty = 0;
      payload.min_qty = 0;
    }

    const updated = await DB.PostgresUpdate(
      "products",
      payload,
      { id: Number(req.params.id) }
    );

    if (!updated) {
      return res.status(404).json({ msg: "Not found" });
    }

    res.json({ success: true, message: "Updated successfully" });

  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ msg: "Update failed" });
  }
};

/* =========================================================
   DELETE PRODUCT (SOFT DELETE)
   ========================================================= */
exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await DB.PostgresUpdate(
      "products",
      { is_active: false },
      { id: Number(req.params.id) }
    );

    if (!deleted) {
      return res.status(404).json({ msg: "Not found" });
    }

    res.json({ success: true, message: "Deleted successfully" });

  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ msg: "Delete failed" });
  }
};
