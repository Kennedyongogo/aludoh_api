// Brings the service_requests table in line with the ServiceRequest model and removes the
// obsolete service_request_updates table. Only drops tables that are empty.
// Safe to run more than once. Usage: npm run migrate:service-requests
const { sequelize, User, ServiceRequest } = require("../src/models");

const countRows = async (table, transaction) => {
  const [[{ count }]] = await sequelize.query(
    `SELECT COUNT(*)::int AS count FROM "${table}"`,
    { transaction }
  );
  return count;
};

const assertEmpty = async (table, transaction) => {
  const rows = await countRows(table, transaction);
  if (rows > 0) {
    throw new Error(
      `${table} has ${rows} row(s); migrate that data manually before running this script.`
    );
  }
};

(async () => {
  const qi = sequelize.getQueryInterface();
  try {
    await sequelize.authenticate();
    const tables = (await qi.showAllTables()).map((t) =>
      typeof t === "string" ? t : t.tableName
    );

    const expected = Object.keys(ServiceRequest.getAttributes()).sort();
    const actual = tables.includes("service_requests")
      ? Object.keys(await qi.describeTable("service_requests")).sort()
      : null;
    const schemaMatches =
      actual && JSON.stringify(actual) === JSON.stringify(expected);

    await sequelize.transaction(async (transaction) => {
      if (tables.includes("service_request_updates")) {
        await assertEmpty("service_request_updates", transaction);
        await qi.dropTable("service_request_updates", { transaction });
        console.log("Dropped obsolete service_request_updates (0 rows)");
      }

      if (actual && !schemaMatches) {
        await assertEmpty("service_requests", transaction);
        await qi.dropTable("service_requests", { transaction });
        console.log("Dropped outdated service_requests (0 rows)");
      }

      await sequelize.query(
        [
          'DROP TYPE IF EXISTS "enum_service_request_updates_status";',
          ...(actual && !schemaMatches
            ? [
                'DROP TYPE IF EXISTS "enum_service_requests_status";',
                'DROP TYPE IF EXISTS "enum_service_requests_priority";',
              ]
            : []),
        ].join(" "),
        { transaction }
      );
    });

    if (schemaMatches) console.log("service_requests already matches the model.");

    await User.sync({ force: false, alter: false });
    await ServiceRequest.sync({ force: false, alter: false });

    const finalColumns = await qi.describeTable("service_requests");
    console.log("service_requests columns:", Object.keys(finalColumns).join(", "));
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
