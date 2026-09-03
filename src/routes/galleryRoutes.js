const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/galleryController");
const { authenticateAdmin } = require("../middleware/auth");
const {
  uploadGalleryImage,
  handleUploadError,
} = require("../middleware/upload");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post(
  "/",
  authenticateAdmin,
  uploadGalleryImage,
  handleUploadError,
  ctrl.create
);
router.put(
  "/:id",
  authenticateAdmin,
  uploadGalleryImage,
  handleUploadError,
  ctrl.update
);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
