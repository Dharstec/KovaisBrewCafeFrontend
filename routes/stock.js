const router = require("express").Router();
const c = require("../controllers/stock.js");

router.get("/", c.getStock);
router.post("/adjust", c.adjustStock);

module.exports = router;
