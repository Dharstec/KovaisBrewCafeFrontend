const DB = require("../middleware/dbFunctions");

/* CREATE BILL (PENDING) */
exports.createBill = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ msg: "Items array required" });
    }

    // create bill
    const bill = await DB.PostgresInsert("bills", {
      status: "PENDING",
      grand_total: 0
    });

    let total = 0;

    for (const i of items) {
      if (!i.productId || !i.name || !i.price || !i.qty) {
        return res.status(400).json({ msg: "Invalid item data" });
      }

      const lineTotal = i.price * i.qty;
      total += lineTotal;

      await DB.PostgresInsert("bill_items", {
        bill_id: bill.id,
        product_id: i.productId,
        product_name: i.name,
        price: i.price,
        qty: i.qty
      });
    }

    await DB.PostgresUpdate(
      "bills",
      { grand_total: total },
      { id: bill.id }
    );

    res.json({
      bill_id: bill.id,
      grand_total: total
    });

  } catch (err) {
    console.error("Create bill error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* COMPLETE BILL */
exports.completeBill = async (req, res) => {
  try {
    await DB.PostgresUpdate(
      "bills",
      { status: "COMPLETED" },
      { id: req.params.id }
    );
    res.json({ message: "Bill completed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* PENDING BILLS + ITEMS */
exports.pendingBills = async (req, res) => {
  try {
    const bills = await DB.PostgresAny(
      "SELECT * FROM bills WHERE status='PENDING' ORDER BY id DESC"
    );

    for (const b of bills) {
      b.items = await DB.PostgresAny(
        `SELECT product_id AS productId,product_name AS name, price, qty
         FROM bill_items WHERE bill_id=$1`,
        [b.id]
      );
    }

    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* COMPLETED BILLS + ITEMS */
exports.completedBills = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      page = 1,
      limit = 6
    } = req.query;

    const pageNo = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNo - 1) * pageSize;

    let where = `WHERE status = 'COMPLETED'`;
    const params = [];

    /* ---------- DATE FILTER ---------- */
    if (start_date && end_date) {
      params.push(start_date, end_date);
      where += ` AND DATE(created_at) BETWEEN $1 AND $2`;
    }

    /* ---------- MAIN BILLS QUERY ---------- */
    const billsQuery = `
      SELECT *
      FROM bills
      ${where}
      ORDER BY id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const bills = await DB.PostgresAny(
      billsQuery,
      [...params, pageSize, offset]
    );

    /* ---------- ITEMS FOR EACH BILL ---------- */
    for (const b of bills) {
      b.items = await DB.PostgresAny(
        `
        SELECT
          product_id AS productId,
          product_name AS name,
          price,
          qty
        FROM bill_items
        WHERE bill_id = $1
        `,
        [b.id]
      );
    }

    /* ---------- COUNT QUERY ---------- */
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM bills
      ${where}
    `;

    const countResult = await DB.PostgresAny(countQuery, params);

    const total = Number(countResult[0].total);
    const totalPages = Math.ceil(total / pageSize);

    /* ---------- RESPONSE ---------- */
    res.json({
      data: bills,
      total,
      totalPages
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


/* UPDATE PENDING BILL */
exports.updateBill = async (req, res) => {
  try {
    const billId = req.params.id;
    const { items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ msg: "Items required" });
    }

    // 1️⃣ ensure bill exists & pending
    const bill = await DB.PostgresAny(
      "SELECT * FROM bills WHERE id=$1 AND status='PENDING'",
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ msg: "Pending bill not found" });
    }

    // 2️⃣ delete old items
    await DB.PostgresDelete("bill_items", "bill_id", billId);

    let total = 0;

    // 3️⃣ insert updated items
    for (const i of items) {
      if (!i.productId || !i.price || !i.qty) {
        return res.status(400).json({ msg: "Invalid item data" });
      }

      const lineTotal = i.price * i.qty;
      total += lineTotal;

      await DB.PostgresInsert("bill_items", {
        bill_id: billId,
        product_id: i.productId,
        product_name: i.name,
        price: i.price,
        qty: i.qty
      });
    }

    // 4️⃣ update total
    await DB.PostgresUpdate(
      "bills",
      { grand_total: total },
      { id: billId }
    );

    res.json({
      message: "Bill updated",
      bill_id: billId,
      grand_total: total
    });

  } catch (err) {
    console.error("Update bill error:", err);
    res.status(500).json({ error: err.message });
  }
};
