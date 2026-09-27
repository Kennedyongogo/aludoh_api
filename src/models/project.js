const { DataTypes } = require("sequelize");

const STATUSES = ["completed", "ongoing"];

// A case study shown on /projects and /projects/:slug
module.exports = (sequelize) => {
  const Project = sequelize.define(
    "Project",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "services", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      // How the client is described publicly, e.g. "Boutique hotel"; real names stay off the site
      client: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      county: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "completed",
        validate: { isIn: [STATUSES] },
      },
      // Shown as "Scale", e.g. "40 acres" or "60 participants"
      size: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      duration: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      summary: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      challenge: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      solution: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // ["Structural load check", ...]
      scope: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      // [{ value: "+38%", label: "Yield per acre" }]; the first one is shown on cards
      results: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      cover_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      // The before/after slider only shows when both are set
      before_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      after_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      // [{ url, caption }]
      gallery: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      seo_title: {
        type: DataTypes.STRING(70),
        allowNull: true,
      },
      seo_description: {
        type: DataTypes.STRING(170),
        allowNull: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
    },
    {
      tableName: "projects",
      timestamps: true,
      paranoid: true,
      indexes: [
        { unique: true, fields: ["slug"] },
        { fields: ["service_id"] },
        { fields: ["is_published", "sort_order"] },
        { fields: ["county"] },
      ],
    }
  );

  Project.STATUSES = STATUSES;

  return Project;
};
