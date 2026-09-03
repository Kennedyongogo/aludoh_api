const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const { initializeModels, setupAssociations } = require("./models");
const { errorHandler } = require("./middleware/errorHandler");

const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const clientRoutes = require("./routes/clientRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const serviceRequestRoutes = require("./routes/serviceRequestRoutes");
const projectRoutes = require("./routes/projectRoutes");
const projectImageRoutes = require("./routes/projectImageRoutes");
const trainingCourseRoutes = require("./routes/trainingCourseRoutes");
const trainingSessionRoutes = require("./routes/trainingSessionRoutes");
const trainingRegistrationRoutes = require("./routes/trainingRegistrationRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const articleRoutes = require("./routes/articleRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const testimonialRoutes = require("./routes/testimonialRoutes");
const contactMessageRoutes = require("./routes/contactMessageRoutes");
const siteSettingRoutes = require("./routes/siteSettingRoutes");
const statsRoutes = require("./routes/statsRoutes");
const { forgotPassword } = require("./controllers/userController");

const app = express();
const uploadsRoot = path.join(__dirname, "..", "uploads");
const uploadFolders = [
  "projects",
  "services",
  "articles",
  "galleries",
  "media",
  "testimonials",
  "misc",
];

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
app.use(cors());
app.use("/uploads", express.static(uploadsRoot));

console.log("🔗 Registering API routes...");
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/service-requests", serviceRequestRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/project-images", projectImageRoutes);
app.use("/api/training-courses", trainingCourseRoutes);
app.use("/api/training-sessions", trainingSessionRoutes);
app.use("/api/training-registrations", trainingRegistrationRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/galleries", galleryRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/testimonials", testimonialRoutes);
app.use("/api/contact-messages", contactMessageRoutes);
app.use("/api/site-settings", siteSettingRoutes);
app.use("/api/stats", statsRoutes);
app.post("/api/auth/forgot", forgotPassword);
console.log("✅ All API routes registered");

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API endpoint not found",
      path: req.originalUrl,
    });
  }
  next();
});

app.use(errorHandler);

const createUploadDirectories = () => {
  [uploadsRoot, ...uploadFolders.map((folder) => path.join(uploadsRoot, folder))].forEach(
    (dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created upload directory: ${dir}`);
      }
    }
  );
};

const initializeApp = async () => {
  try {
    console.log("🚀 Initializing application...");

    createUploadDirectories();
    console.log("✅ Upload directories ready");

    await initializeModels();
    console.log("✅ Database models initialized");

    setupAssociations();
    console.log("✅ Model associations configured");

    console.log("✅ Application initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing application:", error);
    console.error("❌ Full error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      parent: error.parent?.message,
      original: error.original?.message,
    });
    throw error;
  }
};

const appInitialized = initializeApp();

module.exports = { app, appInitialized };
