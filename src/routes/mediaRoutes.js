const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/mediaController");
const { authenticateAdmin } = require("../middleware/auth");
const { uploadMediaFile, handleUploadError } = require("../middleware/upload");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post(
  "/",
  authenticateAdmin,
  uploadMediaFile,
  handleUploadError,
  ctrl.create
);
router.put(
  "/:id",
  authenticateAdmin,
  uploadMediaFile,
  handleUploadError,
  ctrl.update
);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
