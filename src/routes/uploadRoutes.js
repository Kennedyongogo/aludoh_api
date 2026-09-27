const express = require("express");
const multer = require("multer");
const router = express.Router();
const { authenticateAdmin } = require("../middleware/auth");
const {
  uploadContentImages,
  CONTENT_FOLDERS,
  CONTENT_IMAGE_MAX_MB,
  CONTENT_IMAGE_MAX_FILES,
} = require("../middleware/upload");

const UPLOAD_ERRORS = {
  LIMIT_FILE_SIZE: `Each image must be ${CONTENT_IMAGE_MAX_MB} MB or smaller`,
  LIMIT_FILE_COUNT: `Upload at most ${CONTENT_IMAGE_MAX_FILES} images at a time`,
  LIMIT_UNEXPECTED_FILE: `Send the images in a field called "images" (at most ${CONTENT_IMAGE_MAX_FILES})`,
};

// Admin: POST /api/uploads/:folder with multipart field "images" (one or more files).
// Returns the paths to save in image fields, e.g. "/uploads/projects/rooftop-1727....jpg"
router.post("/:folder", authenticateAdmin, (req, res) => {
  if (!CONTENT_FOLDERS.includes(req.params.folder)) {
    return res.status(400).json({
      success: false,
      message: `Folder must be one of: ${CONTENT_FOLDERS.join(", ")}`,
    });
  }

  uploadContentImages(req, res, (error) => {
    if (error) {
      const message =
        (error instanceof multer.MulterError && UPLOAD_ERRORS[error.code]) || error.message;
      return res.status(400).json({ success: false, message });
    }
    if (!req.files?.length) {
      return res.status(400).json({ success: false, message: "Choose at least one image to upload" });
    }

    return res.status(201).json({
      success: true,
      message: `${req.files.length} image(s) uploaded`,
      data: req.files.map((file) => ({
        path: `/uploads/${req.params.folder}/${file.filename}`,
        name: file.originalname,
        size: file.size,
      })),
    });
  });
});

module.exports = router;
