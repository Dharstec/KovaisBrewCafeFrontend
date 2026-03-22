const express = require('express');
const router = express.Router();
const { login ,createUser} = require('../controllers/users');


router.post('/create', createUser);

// Login
router.post('/login', login);

module.exports = router;