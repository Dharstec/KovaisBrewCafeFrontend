const router = require("express").Router();
const c = require("../controllers/stock.js");

router.get("/stock", c.getStock);
router.get("/stock_dropdown", c.getDropDownStock);
router.post("/stock/adjust", c.adjustStock);

module.exports = router;
