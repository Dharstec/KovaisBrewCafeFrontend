const router = require("express").Router();
const c = require("../controllers/attendance");

router.get("/attendance", c.getAttendanceByDate);
router.post("/attendance", c.markAttendance);

module.exports = router;
