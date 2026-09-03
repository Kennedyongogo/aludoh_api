const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/projectImageController");
const { authenticateAdmin } = require("../middleware/auth");
const {
  uploadProjectImage,
  handleUploadError,
} = require("../middleware/upload");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post(
  "/",
  authenticateAdmin,
  uploadProjectImage,
  handleUploadError,
  ctrl.create
);
router.put(
  "/:id",
  authenticateAdmin,
  uploadProjectImage,
  handleUploadError,
  ctrl.update
);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
