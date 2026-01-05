const DB = require("../middleware/dbFunctions");

/* ================= ADD ADVANCE ================= */
exports.addAdvance = async (req, res) => {
  try {
    const { employee_id, amount, advance_date, note } = req.body;

    if (!employee_id || !amount || !advance_date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* INSERT ADVANCE */
    await DB.PostgresInsert("employee_advance", {
      employee_id,
      amount,
      advance_date,
      note: note || null
    });

    // /* UPDATE EMPLOYEE ADVANCE */
    // await DB.PostgresAny(
    //   `
    //   UPDATE employees
    //   SET advance = COALESCE(advance, 0) + $1
    //   WHERE id = $2
    //   `,
    //   [amount, employee_id]
    // );

    res.json({ message: "Advance added successfully" });

  } catch (err) {
    console.error("Add advance error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ================= ADVANCE HISTORY ================= */
exports.getAdvanceHistory = async (req, res) => {
  try {
    const { employee_id } = req.query;

    if (!employee_id) {
      return res.status(400).json({ message: "employee_id is required" });
    }

    const data = await DB.PostgresAny(
      `
      SELECT
       *
      FROM employee_advance
      WHERE employee_id = $1
      ORDER BY advance_date DESC
      `,
      [employee_id]
    );

    res.json(data);

  } catch (err) {
    console.error("Advance history error:", err);
    res.status(500).json({ error: err.message });
  }
};
