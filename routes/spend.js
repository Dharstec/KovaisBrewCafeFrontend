const express = require('express');
const router = express.Router();
const {
  getAllRecords,
  addRecord,
  updateRecord,
  deleteRecord
} = require('../controllers/spend.js');
const { verifyToken } = require("../middleware/auth.js");

router.get('/spend', verifyToken, getAllRecords);
router.post('/spend', verifyToken, addRecord);
router.put('/spend/:id', verifyToken, updateRecord);
router.delete('/spend/:id', verifyToken, deleteRecord);

module.exports = router;