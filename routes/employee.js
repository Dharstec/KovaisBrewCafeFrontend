const router = require("express").Router();
const c = require("../controllers/employee.js");
const { verifyToken } = require("../middleware/auth.js");

router.get("/employees", verifyToken, c.getEmployees);
router.post("/employees", verifyToken, c.createEmployee);
router.put("/employees/:id", verifyToken, c.updateEmployee);

module.exports = router;
