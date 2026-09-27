const { DataTypes } = require("sequelize");

const STATUSES = ["active", "draft"];

// Animated illustrations the public site can draw (ICONS in aludoh_public HeroServiceAnimations.jsx)
const ICONS = [
  "hydroponic-farming",
  "vertical-farming",
  "organic-agriculture",
  "agronomy-consultancy",
  "landscaping",
  "training",
  "eia-services",
  "generic",
];

// Small icons for benefit cards (BENEFIT_ICONS in aludoh_public ServiceBits.jsx)
const BENEFIT_ICONS = [
  "water",
  "yield",
  "leaf",
  "space",
  "design",
  "eco",
  "money",
  "shield",
  "support",
  "clock",
  "school",
  "doc",
];

const PACKAGE_UNITS = ["from", "per month", "custom"];

module.exports = (sequelize) => {
  const Service = sequelize.define(
    "Service",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      // Unique among live services; checked in the controller so a deleted name can be reused
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      // Used in /services/:slug and /request-service?service=:slug, so keep it stable once published
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      // Chip label where the full name is too long, e.g. "Hydroponics"
      short_name: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      icon: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "generic",
        validate: { isIn: [ICONS] },
      },
      tagline: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      short_description: {
        type: DataTypes.STRING(300),
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
      // ["/uploads/services/a.jpg", ...]
      gallery: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      // What is included, e.g. ["NFT systems", "Drip systems"]
      offerings: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      ideal_for: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      timeline: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      // Headline figure, e.g. "90%" + "less water than open-field farming"
      stat_value: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      stat_label: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      // [{ icon, title, text }]
      benefits: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      // [{ title, text }]
      process_steps: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      // [{ name, price (KES, null when custom), unit, popular, features: [] }]
      packages: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      // [{ question, answer }]
      faqs: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
        validate: { isIn: [STATUSES] },
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
      tableName: "services",
      timestamps: true,
      // Deleted services stay in the table so old projects and testimonials keep their link
      paranoid: true,
      indexes: [
        { unique: true, fields: ["slug"] },
        { fields: ["status", "sort_order"] },
      ],
    }
  );

  Service.STATUSES = STATUSES;
  Service.ICONS = ICONS;
  Service.BENEFIT_ICONS = BENEFIT_ICONS;
  Service.PACKAGE_UNITS = PACKAGE_UNITS;

  return Service;
};
