const { DataTypes } = require("sequelize");

const STATUSES = ["pending", "approved", "rejected"];
const SOURCES = ["website", "admin", "whatsapp", "phone", "email"];

// One table for every client quote: the testimonials page, the home page and project case
// studies (linked through project_id) all read from here.
module.exports = (sequelize) => {
  const Testimonial = sequelize.define(
    "Testimonial",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      client_name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      // e.g. "Wanjiru Greens, Kiambu"
      organization: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      // e.g. "Deputy Head Teacher"
      role: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      // Optional so quotes collected offline without a star rating can still be published
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 1, max: 5 },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      photo: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "services", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "projects", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        validate: { isIn: [STATUSES] },
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      source: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "website",
        validate: { isIn: [SOURCES] },
      },
      // Private: used to confirm the testimonial is genuine, never returned publicly
      email: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      admin_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "testimonials",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["status", "is_featured", "sort_order"] },
        { fields: ["service_id"] },
        { fields: ["project_id"] },
      ],
    }
  );

  Testimonial.STATUSES = STATUSES;
  Testimonial.SOURCES = SOURCES;

  return Testimonial;
};
