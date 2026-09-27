const { DataTypes } = require("sequelize");

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const MODES = ["Physical", "Online", "Physical / Online"];

// A training course on /training and /training/:slug; its dates live in course_sessions
module.exports = (sequelize) => {
  const Course = sequelize.define(
    "Course",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      level: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: { isIn: [LEVELS] },
      },
      short_description: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      image: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      // e.g. "3 Days"
      duration: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      mode: {
        type: DataTypes.STRING(30),
        allowNull: true,
        validate: { isIn: [MODES] },
      },
      // e.g. "Nairobi & Online"
      location: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      // Default fee per participant in KES; a session can override it
      fee: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // ["Set up a working NFT system", ...]
      outcomes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      audience: {
        type: DataTypes.STRING(300),
        allowNull: true,
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
      tableName: "courses",
      timestamps: true,
      paranoid: true,
      indexes: [{ unique: true, fields: ["slug"] }, { fields: ["is_published", "sort_order"] }, { fields: ["category"] }],
    }
  );

  Course.LEVELS = LEVELS;
  Course.MODES = MODES;

  return Course;
};
