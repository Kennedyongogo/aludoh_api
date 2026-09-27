const express = require("express");
const compression = require("compression");
const router = express.Router();
const ctrl = require("../controllers/countyController");
const { authenticateAdmin } = require("../middleware/auth");

router.get("/geojson", authenticateAdmin, compression(), ctrl.geojson);

module.exports = router;
