const { DataTypes } = require("sequelize");

const STATUSES = ["valid", "revoked"];

// A completion certificate that anyone can check on /verify/:certificate_number
module.exports = (sequelize) => {
  const Certificate = sequelize.define(
    "Certificate",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      // e.g. "MCA-CERT-2026-0007"
      certificate_number: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      booking_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "training_bookings", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      course_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "courses", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      recipient_name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      recipient_email: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      organization: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      // Printed on the certificate, so it stays as issued even if the course changes
      course_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      completed_on: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      issued_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "valid",
        validate: { isIn: [STATUSES] },
      },
      revoked_reason: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      issued_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
    },
    {
      tableName: "training_certificates",
      timestamps: true,
      paranoid: true,
      indexes: [
        { unique: true, fields: ["certificate_number"] },
        { fields: ["booking_id"] },
        { fields: ["course_id"] },
        { fields: ["status"] },
      ],
    }
  );

  Certificate.STATUSES = STATUSES;

  return Certificate;
};
