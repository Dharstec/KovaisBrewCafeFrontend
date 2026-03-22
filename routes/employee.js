const router = require("express").Router();
const c = require("../controllers/employee.js");
const { verifyToken } = require("../middleware/auth.js");

router.post("/employee", verifyToken, c.saveEmployee);
router.get("/employee", verifyToken, c.getEmployees);
router.post("/employee", verifyToken, c.createEmployee);
router.put("/employee/:id", verifyToken, c.updateEmployee);

module.exports = router;
