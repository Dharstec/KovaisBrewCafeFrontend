const DB = require("../middleware/dbFunctions");

exports.getAllProductsBilling = async (req, res) => {
    const { search, category_id } = req.query;

    let query = `
        SELECT
            p.id,
            p.name,
            p.price,
            p.image_url,
            p.category_id,
            p.is_manual_price,
            c.name AS category,
            p.is_active
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = true
    `;

    const params = [];

    if (search) {
        params.push(`%${search.toLowerCase()}%`);
        query += ` AND LOWER(p.name) LIKE $${params.length}`;
    }

    if (category_id) {
        params.push(category_id);
        query += ` AND p.category_id = $${params.length}`;
    }

    query += " ORDER BY p.name ASC";

    const products = await DB.PostgresAny(query, params);
    res.json(products);
};


/* ================= GET ALL PRODUCTS ================= */
exports.getAllProducts = async (req, res) => {
  try {
    const {
      search = '',
      category_id,
      page = 1,
      limit = 10
    } = req.query;

    const pageNo = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNo - 1) * pageSize;

    let where = `WHERE p.is_active = true`;
    const params = [];

    /* ---------- SEARCH ---------- */
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND LOWER(p.name) LIKE $${params.length}`;
    }

    /* ---------- CATEGORY FILTER ---------- */
    if (category_id) {
      params.push(category_id);
      where += ` AND p.category_id = $${params.length}`;
    }

    /* ---------- DATA QUERY ---------- */
    const dataQuery = `
      SELECT
        p.id,
        p.name,
        p.price,
        p.image_url,
        p.category_id,
        p.is_manual_price,
        p.is_active,
        c.name AS category
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.name ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const dataParams = [...params, pageSize, offset];

    /* ---------- COUNT QUERY ---------- */
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM products p
      ${where}
    `;

    const products = await DB.PostgresAny(dataQuery, dataParams);
    const countResult = await DB.PostgresAny(countQuery, params);

    const total = Number(countResult[0].total);
    const totalPages = Math.ceil(total / pageSize);

    /* ---------- RESPONSE ---------- */
    res.json({
      data: products,
      page: pageNo,
      limit: pageSize,
      total,
      totalPages
    });

  } catch (err) {
    console.error('getAllProducts error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


/* ================= GET PRODUCT BY ID ================= */
exports.getProductById = async (req, res) => {
    const data = await DB.PostgresAny(
        `
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
        WHERE p.id = $1
        `,
        [Number(req.params.id)]
    );

    if (!data.length) {
        return res.status(404).json({ msg: "Not found" });
    }

    res.json(data[0]);
};

/* ================= CREATE PRODUCT ================= */
exports.createProduct = async (req, res) => {
    const { name, price, category_id, image_url } = req.body;

    if (!name || price === undefined || !category_id) {
        return res.status(400).json({ msg: "Name, price & category required" });
    }

    const product = await DB.PostgresInsert("products", {
        name,
        price,
        category_id,
        is_manual_price : req.body.is_manual_price || false,
        image_url: image_url || null,
        is_active: true
    });

    res.status(201).json({ success: true, product });
};

/* ================= UPDATE PRODUCT ================= */
exports.updateProduct = async (req, res) => {
    const { name, price, category_id, image_url } = req.body;

    const updated = await DB.PostgresUpdate(
        "products",
        {
            name,
            price,
            category_id,
            image_url,
            is_manual_price: req.body.is_manual_price || false
        },
        { id: Number(req.params.id) }
    );

    if (!updated) {
        return res.status(404).json({ msg: "Not found" });
    }

    res.json({ success: true, message: "Updated successfully" });
};

/* ================= DELETE PRODUCT (SOFT) ================= */
exports.deleteProduct = async (req, res) => {
    const deleted = await DB.PostgresUpdate(
        "products",
        { is_active: false },
        { id: Number(req.params.id) }
    );

    if (!deleted) {
        return res.status(404).json({ msg: "Not found" });
    }

    res.json({ success: true, message: "Deleted successfully" });
};


