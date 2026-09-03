const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/testimonialController");
const { authenticateAdmin } = require("../middleware/auth");
const {
  uploadTestimonialPhoto,
  handleUploadError,
} = require("../middleware/upload");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post(
  "/",
  authenticateAdmin,
  uploadTestimonialPhoto,
  handleUploadError,
  ctrl.create
);
router.put(
  "/:id",
  authenticateAdmin,
  uploadTestimonialPhoto,
  handleUploadError,
  ctrl.update
);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
