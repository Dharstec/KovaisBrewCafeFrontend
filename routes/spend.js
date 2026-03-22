const express = require('express');
const router = express.Router();
const {
  getAllRecords,
  addRecord,
  updateRecord,
  deleteRecord
} = require('../controllers/spend.js');
const { verifyToken } = require("../middleware/auth.js");

router.get('/shop_spend', verifyToken, getAllRecords);
router.post('/shop_spend', verifyToken, addRecord);
router.put('/shop_spend/:id', verifyToken, updateRecord);
router.delete('/shop_spend/:id', verifyToken, deleteRecord);

module.exports = router;