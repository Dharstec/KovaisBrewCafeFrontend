const express = require("express");
const router = express.Router();
const controller = require("../controllers/product");
const { verifyToken } = require("../middleware/auth.js");

router.get("/products_billing", verifyToken, controller.getAllProductsBilling);
router.get("/products", verifyToken, controller.getAllProducts);
router.get("/products/:id", verifyToken, controller.getProductById);
router.post("/products", verifyToken, controller.createProduct);
router.put("/products/:id", verifyToken, controller.updateProduct);
router.delete("/products/:id", verifyToken, controller.deleteProduct);
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
