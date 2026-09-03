const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/articleController");
const { authenticateAdmin } = require("../middleware/auth");
const {
  uploadArticleImage,
  handleUploadError,
} = require("../middleware/upload");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post(
  "/",
  authenticateAdmin,
  uploadArticleImage,
  handleUploadError,
  ctrl.create
);
router.put(
  "/:id",
  authenticateAdmin,
  uploadArticleImage,
  handleUploadError,
  ctrl.update
);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
