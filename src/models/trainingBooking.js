const { DataTypes } = require("sequelize");

const STATUSES = ["pending", "confirmed", "attended", "cancelled"];
// Bookings in these states hold seats in their session
const SEAT_HOLDING = ["pending", "confirmed", "attended"];
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"];
const SOURCES = ["website", "admin", "phone", "whatsapp", "email"];

// A seat reservation from the booking form on /training/:slug (or entered by an admin)
module.exports = (sequelize) => {
  const TrainingBooking = sequelize.define(
    "TrainingBooking",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      // Shown to the visitor, e.g. "MCA-2026-48213"
      reference: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      course_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "courses", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      // Kept so the booking still reads correctly if the course is renamed or deleted
      course_name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      // Empty when the visitor asked for another date instead of picking a session
      session_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "course_sessions", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      preferred_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
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
      },
      organization: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      participants: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      // KES per participant when the booking was made
      unit_fee: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      total_fee: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        validate: { isIn: [STATUSES] },
      },
      payment_status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "unpaid",
        validate: { isIn: [PAYMENT_STATUSES] },
      },
      amount_paid: {
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
      admin_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      handled_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      confirmed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "training_bookings",
      timestamps: true,
      paranoid: true,
      indexes: [
        { unique: true, fields: ["reference"] },
        { fields: ["status", "createdAt"] },
        { fields: ["course_id"] },
        { fields: ["session_id"] },
      ],
    }
  );

  TrainingBooking.STATUSES = STATUSES;
  TrainingBooking.SEAT_HOLDING = SEAT_HOLDING;
  TrainingBooking.PAYMENT_STATUSES = PAYMENT_STATUSES;
  TrainingBooking.SOURCES = SOURCES;

  return TrainingBooking;
};
