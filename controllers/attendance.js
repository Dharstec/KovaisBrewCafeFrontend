const DB = require("../middleware/dbFunctions");

exports.markAttendance = async (req, res) => {
  const rows = req.body;

  for (const r of rows) {
    await DB.PostgresUpsert(
      "attendance",
      {
        employee_id: r.employee_id,
        date: r.date,
        status: r.status
      },
      ['employee_id', 'date'],   // ✅ conflictCols (ARRAY)
      ['status']                 // ✅ updateCols (ARRAY)
    );
  }

  res.json({ message: "Attendance saved successfully" });
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
    ORDER BY e.name
    `,
    [date]
  );

  res.json(data);
};
