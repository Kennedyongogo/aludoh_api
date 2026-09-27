const { sequelize } = require("../config/database");

const User = require("./user")(sequelize);
const ServiceRequest = require("./serviceRequest")(sequelize);
const Service = require("./service")(sequelize);
const ServiceGoal = require("./serviceGoal")(sequelize);
const Project = require("./project")(sequelize);
const Testimonial = require("./testimonial")(sequelize);
const GalleryAlbum = require("./galleryAlbum")(sequelize);
const Article = require("./article")(sequelize);
const Course = require("./course")(sequelize);
const CourseSession = require("./courseSession")(sequelize);
const TrainingBooking = require("./trainingBooking")(sequelize);
const Certificate = require("./certificate")(sequelize);

const models = {
  User,
  ServiceRequest,
  Service,
  ServiceGoal,
  Project,
  Testimonial,
  GalleryAlbum,
  Article,
  Course,
  CourseSession,
  TrainingBooking,
  Certificate,
};

// sync({ alter: false }) never adds columns, so new optional model fields are added here.
// Only nullable columns are handled; anything else needs a proper migration.
const addMissingColumns = async (model) => {
  const qi = sequelize.getQueryInterface();
  const table = model.getTableName();
  const existing = await qi.describeTable(table);

  for (const [name, attribute] of Object.entries(model.getAttributes())) {
    const column = attribute.field || name;
    if (existing[column]) continue;
    if (attribute.allowNull === false) {
      console.warn(`⚠️ ${table}.${column} is missing and NOT NULL; add it with a migration`);
      continue;
    }
    await qi.addColumn(table, column, { type: attribute.type, allowNull: true });
    console.log(`➕ Added column ${table}.${column}`);
  }
};

// Parent tables first so foreign keys can be created
const SYNC_ORDER = [
  User,
  ServiceRequest,
  Service,
  ServiceGoal,
  Project,
  Testimonial,
  GalleryAlbum,
  Article,
  Course,
  CourseSession,
  TrainingBooking,
  Certificate,
];

const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    // Use alter: false to prevent schema conflicts in production
    for (const model of SYNC_ORDER) {
      await model.sync({ force: false, alter: false });
      if (model !== User) await addMissingColumns(model);
    }

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
  // User ↔ ServiceRequest (admin handling the request)
  User.hasMany(ServiceRequest, {
    foreignKey: "handled_by",
    as: "handledRequests",
  });
  ServiceRequest.belongsTo(User, {
    foreignKey: "handled_by",
    as: "handler",
  });

  // Service → projects and testimonials
  Service.hasMany(Project, { foreignKey: "service_id", as: "projects" });
  Project.belongsTo(Service, { foreignKey: "service_id", as: "service" });

  Service.hasMany(Testimonial, { foreignKey: "service_id", as: "testimonials" });
  Testimonial.belongsTo(Service, { foreignKey: "service_id", as: "service" });

  // Project → client quotes shown on the case study
  Project.hasMany(Testimonial, { foreignKey: "project_id", as: "testimonials" });
  Testimonial.belongsTo(Project, { foreignKey: "project_id", as: "project" });

  // Audit trail
  Service.belongsTo(User, { foreignKey: "created_by", as: "creator" });
  Service.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
  Project.belongsTo(User, { foreignKey: "created_by", as: "creator" });
  Project.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
  Testimonial.belongsTo(User, { foreignKey: "reviewed_by", as: "reviewer" });
  GalleryAlbum.belongsTo(User, { foreignKey: "created_by", as: "creator" });
  GalleryAlbum.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
  Article.belongsTo(User, { foreignKey: "created_by", as: "creator" });
  Article.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
  Course.belongsTo(User, { foreignKey: "created_by", as: "creator" });
  Course.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

  // Training: course → dated sessions → bookings → certificates
  Course.hasMany(CourseSession, { foreignKey: "course_id", as: "sessions" });
  CourseSession.belongsTo(Course, { foreignKey: "course_id", as: "course" });

  Course.hasMany(TrainingBooking, { foreignKey: "course_id", as: "bookings" });
  TrainingBooking.belongsTo(Course, { foreignKey: "course_id", as: "course" });
  CourseSession.hasMany(TrainingBooking, { foreignKey: "session_id", as: "bookings" });
  TrainingBooking.belongsTo(CourseSession, { foreignKey: "session_id", as: "session" });
  TrainingBooking.belongsTo(User, { foreignKey: "handled_by", as: "handler" });

  TrainingBooking.hasMany(Certificate, { foreignKey: "booking_id", as: "certificates" });
  Certificate.belongsTo(TrainingBooking, { foreignKey: "booking_id", as: "booking" });
  Course.hasMany(Certificate, { foreignKey: "course_id", as: "certificates" });
  Certificate.belongsTo(Course, { foreignKey: "course_id", as: "course" });
  Certificate.belongsTo(User, { foreignKey: "issued_by", as: "issuer" });
};

setupAssociations();

module.exports = { ...models, initializeModels, sequelize };
