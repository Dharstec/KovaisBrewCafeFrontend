const DB = require("../middleware/dbFunctions");

/* =========================================================
   CREATE BILL (PENDING) + REDUCE STOCK (DIRECT + RECIPE)
   ========================================================= */
exports.createBill = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ msg: "Items array required" });
    }

    /* 1️⃣ Create pending bill */
    const bill = await DB.PostgresInsert("bills", {
      status: "PENDING",
      grand_total: 0
    });

    let total = 0;

    for (const i of items) {
      if (!i.productId || !i.name || !i.price || !i.qty) {
        return res.status(400).json({ msg: "Invalid item data" });
      }

      /* 2️⃣ Insert bill item */
      await DB.PostgresInsert("bill_items", {
        bill_id: bill.id,
        product_id: i.productId,
        product_name: i.name,
        price: i.price,
        qty: i.qty
      });

      total += Number(i.price) * Number(i.qty);

      /* 3️⃣ DIRECT STOCK (sellable stock items) */
      const product = await DB.PostgresAny(
        `SELECT track_stock, current_qty
         FROM products
         WHERE id = $1`,
        [i.productId]
      );

      if (product.length && product[0].track_stock) {
        const newQty =
          Number(product[0].current_qty) - Number(i.qty);

        if (newQty < 0) {
          return res.status(400).json({
            msg: `Insufficient stock for ${i.name}`
          });
        }

        await DB.PostgresUpdate(
          "products",
          { current_qty: newQty },
          { id: i.productId }
        );

        await DB.PostgresInsert("stock_logs", {
          product_id: i.productId,
          change_qty: -i.qty,
          action: "SALE",
          reference_id: bill.id,
          note: `Pending bill #${bill.id}`
        });
      }

      /* 4️⃣ RECIPE BASED STOCK (Egg Maggi, Chicken Maggi) */
      const recipes = await DB.PostgresAny(
        `
        SELECT raw_product_id, used_qty
        FROM product_recipes
        WHERE sale_product_id = $1
        `,
        [i.productId]
      );

      for (const r of recipes) {
        const totalUsed =
          Number(r.used_qty) * Number(i.qty);

        const raw = await DB.PostgresAny(
          `
          SELECT current_qty
          FROM products
          WHERE id = $1
            AND track_stock = true
          `,
          [r.raw_product_id]
        );

        if (!raw.length || raw[0].current_qty < totalUsed) {
          return res.status(400).json({
            msg: "Insufficient raw material stock"
          });
        }

        await DB.PostgresUpdate(
          "products",
          { current_qty: raw[0].current_qty - totalUsed },
          { id: r.raw_product_id }
        );

        await DB.PostgresInsert("stock_logs", {
          product_id: r.raw_product_id,
          change_qty: -totalUsed,
          action: "USAGE",
          reference_id: bill.id,
          note: `Recipe usage for ${i.name}`
        });
      }
    }

    /* 5️⃣ Update bill total */
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

/* =========================================================
   UPDATE PENDING BILL (RESTORE + APPLY STOCK)
   ========================================================= */
exports.updateBill = async (req, res) => {
  try {
    const billId = Number(req.params.id);
    const { items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ msg: "Items required" });
    }

    /* 1️⃣ Ensure pending bill */
    const bill = await DB.PostgresAny(
      `SELECT id FROM bills
       WHERE id=$1 AND status='PENDING'`,
      [billId]
    );

    if (!bill.length) {
      return res.status(404).json({ msg: "Pending bill not found" });
    }

    /* 2️⃣ RESTORE DIRECT STOCK */
    const oldItems = await DB.PostgresAny(
      `
      SELECT bi.product_id, bi.qty, p.track_stock
      FROM bill_items bi
      JOIN products p ON p.id = bi.product_id
      WHERE bi.bill_id = $1
      `,
      [billId]
    );

    for (const i of oldItems) {
      if (!i.track_stock) continue;

      const prod = await DB.PostgresAny(
        `SELECT current_qty FROM products WHERE id=$1`,
        [i.product_id]
      );

      await DB.PostgresUpdate(
        "products",
        { current_qty: Number(prod[0].current_qty) + Number(i.qty) },
        { id: i.product_id }
      );
    }

    /* 3️⃣ RESTORE RECIPE STOCK */
    const oldRecipes = await DB.PostgresAny(
      `
      SELECT pr.raw_product_id, pr.used_qty, bi.qty
      FROM bill_items bi
      JOIN product_recipes pr
        ON pr.sale_product_id = bi.product_id
      WHERE bi.bill_id = $1
      `,
      [billId]
    );

    for (const r of oldRecipes) {
      const restoreQty =
        Number(r.used_qty) * Number(r.qty);

      const raw = await DB.PostgresAny(
        `SELECT current_qty FROM products WHERE id=$1`,
        [r.raw_product_id]
      );

      await DB.PostgresUpdate(
        "products",
        { current_qty: Number(raw[0].current_qty) + restoreQty },
        { id: r.raw_product_id }
      );
    }

    /* 4️⃣ DELETE OLD ITEMS */
    await DB.PostgresDelete("bill_items", "bill_id", billId);

    let total = 0;

    /* 5️⃣ ADD NEW ITEMS + APPLY STOCK */
    for (const i of items) {

      await DB.PostgresInsert("bill_items", {
        bill_id: billId,
        product_id: i.productId,
        product_name: i.name,
        price: i.price,
        qty: i.qty
      });

      total += Number(i.price) * Number(i.qty);

      /* DIRECT STOCK */
      const product = await DB.PostgresAny(
        `SELECT track_stock, current_qty FROM products WHERE id=$1`,
        [i.productId]
      );

      if (product[0]?.track_stock) {
        const newQty =
          Number(product[0].current_qty) - Number(i.qty);

        if (newQty < 0) {
          return res.status(400).json({
            msg: `Insufficient stock for ${i.name}`
          });
        }

        await DB.PostgresUpdate(
          "products",
          { current_qty: newQty },
          { id: i.productId }
        );
      }

      /* RECIPE STOCK */
      const recipes = await DB.PostgresAny(
        `
        SELECT raw_product_id, used_qty
        FROM product_recipes
        WHERE sale_product_id = $1
        `,
        [i.productId]
      );

      for (const r of recipes) {
        const totalUsed =
          Number(r.used_qty) * Number(i.qty);

        const raw = await DB.PostgresAny(
          `SELECT current_qty FROM products WHERE id=$1`,
          [r.raw_product_id]
        );

        if (raw[0].current_qty < totalUsed) {
          return res.status(400).json({
            msg: "Insufficient raw material stock"
          });
        }

        await DB.PostgresUpdate(
          "products",
          { current_qty: raw[0].current_qty - totalUsed },
          { id: r.raw_product_id }
        );
      }
    }

    /* 6️⃣ UPDATE TOTAL */
    await DB.PostgresUpdate(
      "bills",
      { grand_total: total },
      { id: billId }
    );

    res.json({
      message: "Bill updated & stock adjusted",
      bill_id: billId,
      grand_total: total
    });

  } catch (err) {
    console.error("Update bill error:", err);
    res.status(500).json({ error: err.message });
  }
};

// exports.completeBill = async (req, res) => {
//   try {
//     await DB.PostgresUpdate(
//       "bills",
//       { status: "COMPLETED" },
//       { id: req.params.id }
//     );

//     res.json({ message: "Bill completed" });

//   } catch (err) {
//     console.error("Complete bill error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

exports.completedBills = async (req, res) => {
  try {
    const { start_date, end_date, page = 1, limit = 6 } = req.query;

    const pageNo = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNo - 1) * pageSize;

    let where = `WHERE status = 'COMPLETED'`;
    const params = [];

    if (start_date && end_date) {
      params.push(start_date, end_date);
      where += ` AND DATE(created_at) BETWEEN $1 AND $2`;
    }

    /* ---------- BILL LIST ---------- */
    const bills = await DB.PostgresAny(
      `
      SELECT *
      FROM bills
      ${where}
      ORDER BY id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, pageSize, offset]
    );

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

    /* ---------- COUNT ---------- */
    const count = await DB.PostgresAny(
      `SELECT COUNT(*) AS total FROM bills ${where}`,
      params
    );

    /* ---------- PAYMENT SUMMARY ---------- */
    const summary = await DB.PostgresAny(
      `
      SELECT
        SUM(CASE WHEN payment_mode = 'CASH' THEN grand_total ELSE 0 END) AS cash_total,
        SUM(CASE WHEN payment_mode = 'UPI' THEN grand_total ELSE 0 END) AS upi_total,
        SUM(net_total) AS grand_total
      FROM bills
      ${where}
      `,
      params
    );

    res.json({
      data: bills,
      total: Number(count[0].total),
      totalPages: Math.ceil(Number(count[0].total) / pageSize),
      summary: summary[0]   // 👈 IMPORTANT
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


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

exports.completeBill = async (req, res) => {
  console.log(req.body)
  try {
    await DB.PostgresUpdate(
      "bills",
      {
        payment_mode: req.body.payment_mode,
        status: "COMPLETED"
      },
      { id: req.params.id }
    );

    res.json({ message: "Bill completed" });

  } catch (err) {
    console.error("Complete bill error:", err);
    res.status(500).json({ error: err.message });
  }
};




