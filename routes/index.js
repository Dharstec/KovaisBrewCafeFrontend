const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send("Kovai's Brew Cafe is Running");
});

module.exports = router;
