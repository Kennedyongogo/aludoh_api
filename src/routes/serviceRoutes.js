const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/serviceController");
const { authenticateAdmin } = require("../middleware/auth");
const {
  uploadServiceImage,
  handleUploadError,
} = require("../middleware/upload");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post(
  "/",
  authenticateAdmin,
  uploadServiceImage,
  handleUploadError,
  ctrl.create
);
router.put(
  "/:id",
  authenticateAdmin,
  uploadServiceImage,
  handleUploadError,
  ctrl.update
);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
