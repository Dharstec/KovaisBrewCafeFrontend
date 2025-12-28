const DB = require("../middleware/dbFunctions");

/* ================= ADD ADVANCE ================= */
exports.addAdvance = async (req, res) => {
  const client = await DB.getClient();

  try {
    const { employee_id, amount, advance_date, note } = req.body;

    if (!employee_id || !amount || !advance_date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO employee_advance
        (employee_id, amount, advance_date, note, created_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [employee_id, amount, advance_date, note || null, req.user_id]
    );

    await client.query(
      `
      UPDATE employees
      SET advance = advance + $1
      WHERE id = $2
      `,
      [amount, employee_id]
    );

    await client.query("COMMIT");
    res.json({ message: "Advance added successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });

  } finally {
    client.release();
  }
};

/* ================= ADVANCE HISTORY ================= */
exports.getAdvanceHistory = async (req, res) => {
  const { employee_id } = req.query;

  const data = await DB.PostgresAny(
    `
    SELECT
      ea.id,
      ea.advance_date,
      ea.amount,
      ea.note,
      ea.created_at,
      u.user_name AS created_by
    FROM employee_advance ea
    JOIN users u ON u.id = ea.created_by
    WHERE ea.employee_id = $1
    ORDER BY ea.advance_date DESC
    `,
    [employee_id]
  );

  res.json(data);
};
