const router = require("express").Router();
const c = require("../controllers/stock.js");

router.get("/stock", c.getStock);
router.post("/stock/adjust", c.adjustStock);

module.exports = router;
