const express = require("express");
const router = express.Router();
const controller = require("../controllers/billing.js");
const { verifyToken } = require("../middleware/auth.js");

router.post("/bills", verifyToken, controller.createBill);
router.post("/bill/complete/:id", verifyToken, controller.completeBill);
router.get("/pending", verifyToken, controller.pendingBills);
router.get("/completed", verifyToken, controller.completedBills);
router.put("/bills/:id", verifyToken, controller.updateBill);

module.exports = router;
