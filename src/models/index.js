const { sequelize } = require("../config/database");

const User = require("./user")(sequelize);
const ServiceRequest = require("./serviceRequest")(sequelize);

const models = { User, ServiceRequest };

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
const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    // Use alter: false to prevent schema conflicts in production
    await User.sync({ force: false, alter: false });
    await ServiceRequest.sync({ force: false, alter: false });
    await addMissingColumns(ServiceRequest);

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
