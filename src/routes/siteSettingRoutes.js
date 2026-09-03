const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/siteSettingController");
const { authenticateAdmin } = require("../middleware/auth");
const { uploadLogo, handleUploadError } = require("../middleware/upload");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", authenticateAdmin, uploadLogo, handleUploadError, ctrl.create);
router.put(
  "/:id",
  authenticateAdmin,
  uploadLogo,
  handleUploadError,
  ctrl.update
);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
