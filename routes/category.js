const express = require("express");
const router = express.Router();
const controller = require("../controllers/category.js"); 
const { verifyToken } = require("../middleware/auth.js");

router.get("/category", verifyToken, controller.getAllCategories);

module.exports = router;
