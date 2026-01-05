const router = require("express").Router();
const c = require("../controllers/coupon");

router.post("/coupons", c.createCoupon);
router.get("/coupons", c.getCoupons);
router.get("/coupons/:id", c.getCouponById);
router.put("/coupons/:id", c.updateCoupon);
router.delete("/coupons/:id", c.deleteCoupon);

router.post("/apply/:billId", c.applyCoupon);

module.exports = router;
