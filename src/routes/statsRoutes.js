const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/statsController");
const { authenticateAdmin } = require("../middleware/auth");

router.get("/dashboard", authenticateAdmin, getDashboardStats);

module.exports = router;
