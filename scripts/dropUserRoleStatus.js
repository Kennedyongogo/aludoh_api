// Removes the legacy role_id and status columns from an existing users table.
// Safe to run more than once. Usage: npm run migrate:users
const { sequelize } = require("../src/config/database");

(async () => {
  const queryInterface = sequelize.getQueryInterface();
  try {
    await sequelize.authenticate();
    const columns = await queryInterface.describeTable("users");

    await sequelize.transaction(async (transaction) => {
      if (columns.role_id) {
        await queryInterface.removeColumn("users", "role_id", { transaction });
        console.log("Dropped users.role_id");
      }
      if (columns.status) {
        await queryInterface.removeColumn("users", "status", { transaction });
        console.log("Dropped users.status");
      }
      if (sequelize.getDialect() === "postgres") {
        await sequelize.query('DROP TYPE IF EXISTS "enum_users_status";', { transaction });
      }
    });

    if (!columns.role_id && !columns.status) {
      console.log("Nothing to do: users table is already up to date.");
    }
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
