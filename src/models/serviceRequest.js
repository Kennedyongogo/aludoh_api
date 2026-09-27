const { DataTypes } = require("sequelize");

const STATUSES = [
  "pending",
  "reviewing",
  "in_progress",
  "scheduled",
  "resolved",
  "cancelled",
];

const PRIORITIES = ["low", "normal", "high", "urgent"];

// Result of looking up the typed location on OpenStreetMap (see services/geocoder.js)
const GEO_STATUSES = ["pending", "found", "approximate", "not_found", "failed"];

module.exports = (sequelize) => {
  const ServiceRequest = sequelize.define(
    "ServiceRequest",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      // Public tracking code shared with the client, e.g. MC-26-7KQ2XD
      reference: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      service: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: true,
        validate: { isEmail: true },
      },
      location: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      organization: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      farm_size: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      crop: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      farming_method: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      service_required: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: "pending",
      },
      priority: {
        type: DataTypes.ENUM(...PRIORITIES),
        allowNull: false,
        defaultValue: "normal",
      },
      // Reply shown to the client when they track their request
      admin_response: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Internal only, never returned by public endpoints
      admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Admin currently handling the request
      handled_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      responded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Estimated from the location text only; the client's device position is never collected
      geo_status: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: { isIn: [GEO_STATUSES] },
      },
      // Text that was searched: the client's location, or a name an admin tried instead
      geo_query: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      geo_place: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      geo_county: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      geo_lat: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      geo_lng: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      // How far from the pin the place may really be
      geo_radius_m: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // Other likely matches in different counties: [{ place, county, lat, lng }]
      geo_candidates: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      geocoded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "service_requests",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["reference"] },
        { fields: ["status"] },
        { fields: ["phone"] },
        { fields: ["handled_by"] },
      ],
    }
  );

  ServiceRequest.STATUSES = STATUSES;
  ServiceRequest.PRIORITIES = PRIORITIES;
  ServiceRequest.GEO_STATUSES = GEO_STATUSES;

  return ServiceRequest;
};
