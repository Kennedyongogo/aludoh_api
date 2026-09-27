// Replaces the services / projects / testimonials tables left over from an earlier template
// (plus project_images, now a JSON gallery on projects) with the current models, and removes
// that template's unused gallery, blog and training tables (the current ones have new names).
// A table is only dropped if it is empty and still has the old layout; otherwise the script
// stops without changing anything. Safe to run more than once.
// Usage: npm run migrate:content
const {
  sequelize,
  initializeModels,
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
} = require("../src/models");

const CONTENT_MODELS = [
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

// Children first so foreign keys never block a drop
const CANDIDATES = [
  { table: "project_images", model: null },
  { table: "testimonials", model: Testimonial },
  { table: "projects", model: Project },
  { table: "services", model: Service },
  { table: "certificates", model: null },
  { table: "training_registrations", model: null },
  { table: "training_sessions", model: null },
  { table: "training_courses", model: null },
  { table: "media", model: null },
  { table: "galleries", model: null },
  { table: "articles", model: null },
  { table: "categories", model: null },
];
const OLD_TABLE_PATTERN =
  "services|projects|testimonials|project_images|certificates|training_registrations|training_sessions|training_courses|media|galleries|articles|categories";

const countRows = async (table, transaction) => {
  const [[{ count }]] = await sequelize.query(`SELECT COUNT(*)::int AS count FROM "${table}"`, {
    transaction,
  });
  return count;
};

(async () => {
  const qi = sequelize.getQueryInterface();
  try {
    await sequelize.authenticate();
    const tables = (await qi.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName));

    const outdated = [];
    for (const { table, model } of CANDIDATES) {
      if (!tables.includes(table)) continue;
      const columns = Object.keys(await qi.describeTable(table));
      const missing = model
        ? Object.keys(model.getAttributes()).filter((name) => !columns.includes(name))
        : ["(table no longer used)"];
      if (missing.length) outdated.push({ table, missing });
    }

    if (!outdated.length) {
      console.log("Content tables already match the models.");
    } else {
      await sequelize.transaction(async (transaction) => {
        for (const { table } of outdated) {
          const rows = await countRows(table, transaction);
          if (rows > 0) {
            throw new Error(`${table} has ${rows} row(s) in the old layout; move that data manually first.`);
          }
        }
        for (const { table, missing } of outdated) {
          await qi.dropTable(table, { transaction });
          console.log(`Dropped old ${table} (0 rows; missing ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? ", ..." : ""})`);
        }

        const enumTypes = await sequelize.query(
          `SELECT typname FROM pg_type WHERE typtype = 'e' AND typname ~ :pattern`,
          { replacements: { pattern: `^enum_(${OLD_TABLE_PATTERN})_` }, type: "SELECT", transaction }
        );
        for (const { typname } of enumTypes) {
          await sequelize.query(`DROP TYPE IF EXISTS "${typname}"`, { transaction });
          console.log(`Dropped unused type ${typname}`);
        }
      });
    }

    await initializeModels();
    for (const model of CONTENT_MODELS) {
      console.log(`${model.getTableName()}: ${Object.keys(await qi.describeTable(model.getTableName())).length} columns`);
    }
  } catch (error) {
    console.error("Migration failed:", error.parent?.message || error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
