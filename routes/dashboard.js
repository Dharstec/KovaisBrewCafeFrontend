const router = require("express").Router();
const c = require("../controllers/dashboard");
const { verifyToken } = require("../middleware/auth.js");

router.get("/dashboard/summary", verifyToken, c.getDashboardSummary);

module.exports = router;
