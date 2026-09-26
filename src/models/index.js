const { sequelize } = require("../config/database");

const User = require("./user")(sequelize);
const ServiceRequest = require("./serviceRequest")(sequelize);

const models = { User, ServiceRequest };

// Parent tables first so foreign keys can be created
const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    // Use alter: false to prevent schema conflicts in production
    await User.sync({ force: false, alter: false });
    await ServiceRequest.sync({ force: false, alter: false });

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
};

setupAssociations();

module.exports = { ...models, initializeModels, sequelize };
