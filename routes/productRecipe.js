const express = require("express");
const router = express.Router();
const controller = require("../controllers/productRecipe");
const { verifyToken } = require("../middleware/auth");

/* Recipe Management */
router.get(
  "/recipes/:sale_product_id",
  verifyToken,
  controller.getRecipeByProduct
);

router.post(
  "/recipes",
  verifyToken,
  controller.saveRecipe
);

router.delete(
  "/recipes/:id",
  verifyToken,
  controller.deleteRecipe
);

module.exports = router;
