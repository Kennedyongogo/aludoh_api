const { sequelize } = require("../config/database");

// Import all models
const Role = require("./role")(sequelize);
const Permission = require("./permission")(sequelize);
const User = require("./user")(sequelize);
const RolePermission = require("./rolePermission")(sequelize);
const Client = require("./client")(sequelize);
const Service = require("./service")(sequelize);
const ServiceRequest = require("./serviceRequest")(sequelize);
const Project = require("./project")(sequelize);
const ProjectImage = require("./projectImage")(sequelize);
const TrainingCourse = require("./trainingCourse")(sequelize);
const TrainingSession = require("./trainingSession")(sequelize);
const TrainingRegistration = require("./trainingRegistration")(sequelize);
const Certificate = require("./certificate")(sequelize);
const Category = require("./category")(sequelize);
const Article = require("./article")(sequelize);
const Gallery = require("./gallery")(sequelize);
const Media = require("./media")(sequelize);
const Testimonial = require("./testimonial")(sequelize);
const ContactMessage = require("./contactMessage")(sequelize);
const SiteSetting = require("./siteSetting")(sequelize);

const models = {
  Role,
  Permission,
  User,
  RolePermission,
  Client,
  Service,
  ServiceRequest,
  Project,
  ProjectImage,
  TrainingCourse,
  TrainingSession,
  TrainingRegistration,
  Certificate,
  Category,
  Article,
  Gallery,
  Media,
  Testimonial,
  ContactMessage,
  SiteSetting,
};

// Initialize models in correct order (parent tables first)
const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    // Use alter: false to prevent schema conflicts in production
    console.log("📋 Syncing parent tables...");
    await Role.sync({ force: false, alter: false });
    await Permission.sync({ force: false, alter: false });
    await Client.sync({ force: false, alter: false });
    await Service.sync({ force: false, alter: false });
    await Category.sync({ force: false, alter: false });
    await Gallery.sync({ force: false, alter: false });
    await TrainingCourse.sync({ force: false, alter: false });
    await ContactMessage.sync({ force: false, alter: false });
    await SiteSetting.sync({ force: false, alter: false });

    console.log("📋 Syncing child tables...");
    await User.sync({ force: false, alter: false });
    await RolePermission.sync({ force: false, alter: false });
    await ServiceRequest.sync({ force: false, alter: false });
    await Project.sync({ force: false, alter: false });
    await TrainingSession.sync({ force: false, alter: false });
    await Testimonial.sync({ force: false, alter: false });
    await Article.sync({ force: false, alter: false });
    await Media.sync({ force: false, alter: false });

    console.log("📋 Syncing nested child tables...");
    await ProjectImage.sync({ force: false, alter: false });
    await TrainingRegistration.sync({ force: false, alter: false });
    await Certificate.sync({ force: false, alter: false });

    console.log("✅ All models synced successfully");
  } catch (error) {
    console.error("❌ Error syncing models:", error);
    console.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      parent: error.parent?.message,
      original: error.original?.message,
      sql: error.sql,
    });
    throw error;
  }
};

const setupAssociations = () => {
  try {
    // Role ↔ User
    models.Role.hasMany(models.User, {
      foreignKey: "role_id",
      as: "users",
    });
    models.User.belongsTo(models.Role, {
      foreignKey: "role_id",
      as: "role",
    });

    // Role ↔ RolePermission
    models.Role.hasMany(models.RolePermission, {
      foreignKey: "role_id",
      as: "rolePermissions",
    });
    models.RolePermission.belongsTo(models.Role, {
      foreignKey: "role_id",
      as: "role",
    });

    // Permission ↔ RolePermission
    models.Permission.hasMany(models.RolePermission, {
      foreignKey: "permission_id",
      as: "rolePermissions",
    });
    models.RolePermission.belongsTo(models.Permission, {
      foreignKey: "permission_id",
      as: "permission",
    });

    // Role ↔ Permission (many-to-many)
    models.Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: "role_id",
      otherKey: "permission_id",
      as: "permissions",
    });
    models.Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: "permission_id",
      otherKey: "role_id",
      as: "roles",
    });

    // User ↔ Article
    models.User.hasMany(models.Article, {
      foreignKey: "author_id",
      as: "articles",
    });
    models.Article.belongsTo(models.User, {
      foreignKey: "author_id",
      as: "author",
    });

    // User ↔ Media
    models.User.hasMany(models.Media, {
      foreignKey: "uploaded_by",
      as: "uploadedMedia",
    });
    models.Media.belongsTo(models.User, {
      foreignKey: "uploaded_by",
      as: "uploader",
    });

    // Service ↔ ServiceRequest
    models.Service.hasMany(models.ServiceRequest, {
      foreignKey: "service_id",
      as: "serviceRequests",
    });
    models.ServiceRequest.belongsTo(models.Service, {
      foreignKey: "service_id",
      as: "service",
    });

    // Client ↔ ServiceRequest
    models.Client.hasMany(models.ServiceRequest, {
      foreignKey: "client_id",
      as: "serviceRequests",
    });
    models.ServiceRequest.belongsTo(models.Client, {
      foreignKey: "client_id",
      as: "client",
    });

    // Client ↔ Project
    models.Client.hasMany(models.Project, {
      foreignKey: "client_id",
      as: "projects",
    });
    models.Project.belongsTo(models.Client, {
      foreignKey: "client_id",
      as: "client",
    });

    // Service ↔ Project
    models.Service.hasMany(models.Project, {
      foreignKey: "service_id",
      as: "projects",
    });
    models.Project.belongsTo(models.Service, {
      foreignKey: "service_id",
      as: "service",
    });

    // Project ↔ ProjectImage
    models.Project.hasMany(models.ProjectImage, {
      foreignKey: "project_id",
      as: "images",
      onDelete: "CASCADE",
    });
    models.ProjectImage.belongsTo(models.Project, {
      foreignKey: "project_id",
      as: "project",
    });

    // TrainingCourse ↔ TrainingSession
    models.TrainingCourse.hasMany(models.TrainingSession, {
      foreignKey: "course_id",
      as: "sessions",
    });
    models.TrainingSession.belongsTo(models.TrainingCourse, {
      foreignKey: "course_id",
      as: "course",
    });

    // TrainingSession ↔ TrainingRegistration
    models.TrainingSession.hasMany(models.TrainingRegistration, {
      foreignKey: "session_id",
      as: "registrations",
    });
    models.TrainingRegistration.belongsTo(models.TrainingSession, {
      foreignKey: "session_id",
      as: "session",
    });

    // Client ↔ TrainingRegistration
    models.Client.hasMany(models.TrainingRegistration, {
      foreignKey: "client_id",
      as: "trainingRegistrations",
    });
    models.TrainingRegistration.belongsTo(models.Client, {
      foreignKey: "client_id",
      as: "client",
    });

    // TrainingRegistration ↔ Certificate
    models.TrainingRegistration.hasOne(models.Certificate, {
      foreignKey: "registration_id",
      as: "certificate",
    });
    models.Certificate.belongsTo(models.TrainingRegistration, {
      foreignKey: "registration_id",
      as: "registration",
    });

    // Category ↔ Article
    models.Category.hasMany(models.Article, {
      foreignKey: "category_id",
      as: "articles",
    });
    models.Article.belongsTo(models.Category, {
      foreignKey: "category_id",
      as: "category",
    });

    // Gallery ↔ Media
    models.Gallery.hasMany(models.Media, {
      foreignKey: "gallery_id",
      as: "media",
    });
    models.Media.belongsTo(models.Gallery, {
      foreignKey: "gallery_id",
      as: "gallery",
    });

    // Client ↔ Testimonial
    models.Client.hasMany(models.Testimonial, {
      foreignKey: "client_id",
      as: "testimonials",
    });
    models.Testimonial.belongsTo(models.Client, {
      foreignKey: "client_id",
      as: "client",
    });

    console.log("✅ All associations set up successfully");
  } catch (error) {
    console.error("❌ Error during setupAssociations:", error);
  }
};

module.exports = { ...models, initializeModels, setupAssociations, sequelize };
