const DB = require("../middleware/dbFunctions");

exports.markAttendance = async (req, res) => {
  const rows = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "Invalid data" });
  }

  const client = await DB.getClient(); // get pg client
  try {
    await client.query("BEGIN");

    for (const r of rows) {
      if (!['P', 'A'].includes(r.status)) {
        throw new Error("Invalid attendance status");
      }

      await client.query(
        `
        INSERT INTO attendance (employee_id, date, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (employee_id, date)
        DO UPDATE SET status = EXCLUDED.status
        `,
        [r.employee_id, r.date, r.status]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Attendance saved successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });

  } finally {
    client.release();
  }
};


exports.getAttendanceByDate = async (req, res) => {
  const { date } = req.query;

  const data = await DB.PostgresAny(
    `
    SELECT 
      e.id AS employee_id,
      e.name,
      COALESCE(a.status, 'A') AS status
    FROM employees e
    LEFT JOIN attendance a 
      ON a.employee_id = e.id AND a.date = $1
    WHERE e.is_active = true
    ORDER BY e.name
    `,
    [date]
  );

  res.json(data);
};

