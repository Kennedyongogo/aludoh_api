const multer = require("multer");
const path = require("path");
const fs = require("fs");

const fieldFolders = {
  image: "services",
  service_image: "services",
  project_image: "projects",
  project_images: "projects",
  featured_image: "articles",
  cover_image: "galleries",
  gallery_image: "galleries",
  file: "media",
  media: "media",
  photo: "testimonials",
  testimonial_photo: "testimonials",
  logo: "misc",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = fieldFolders[file.fieldname] || "misc";
    const uploadPath = path.join(__dirname, "..", "..", "uploads", folder);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, `${sanitizedBasename}-${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: ${Object.values(
          allowedTypes
        ).join(", ")}`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const maybeMultipart = (middleware) => (req, res, next) => {
  if (
    req.headers["content-type"] &&
    req.headers["content-type"].includes("multipart/form-data")
  ) {
    return middleware(req, res, next);
  }
  next();
};

const uploadServiceImage = maybeMultipart(upload.single("image"));
const uploadProjectImage = maybeMultipart(upload.single("project_image"));
const uploadProjectImages = maybeMultipart(upload.array("project_images", 10));
const uploadArticleImage = maybeMultipart(upload.single("featured_image"));
const uploadGalleryImage = maybeMultipart(upload.single("cover_image"));
const uploadMediaFile = maybeMultipart(upload.single("file"));
const uploadTestimonialPhoto = maybeMultipart(upload.single("photo"));
const uploadLogo = maybeMultipart(upload.single("logo"));

const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 20MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 10 files.",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field.",
      });
    }
  }

  if (error && error.message && error.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
};

const deleteFile = async (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

module.exports = {
  uploadServiceImage,
  uploadProjectImage,
  uploadProjectImages,
  uploadArticleImage,
  uploadGalleryImage,
  uploadMediaFile,
  uploadTestimonialPhoto,
  uploadLogo,
  handleUploadError,
  deleteFile,
};
