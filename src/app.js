const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const { initializeModels } = require("./models");
const { errorHandler } = require("./middleware/errorHandler");

const userRoutes = require("./routes/userRoutes");
const serviceRequestRoutes = require("./routes/serviceRequestRoutes");
const { forgotPassword } = require("./controllers/userController");

const app = express();
const uploadsRoot = path.join(__dirname, "..", "uploads");
const uploadFolders = ["misc"];

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
app.use(cors());
app.use("/uploads", express.static(uploadsRoot));

console.log("🔗 Registering API routes...");
app.use("/api/users", userRoutes);
app.use("/api/service-requests", serviceRequestRoutes);
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
