const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TrainingRegistration = sequelize.define(
    "TrainingRegistration",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      session_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "training_sessions", key: "id" },
      },
      client_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "clients", key: "id" },
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "confirmed",
          "cancelled",
          "completed"
        ),
        allowNull: false,
        defaultValue: "pending",
      },
    },
    {
      tableName: "training_registrations",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["session_id", "client_id"],
        },
        {
          fields: ["session_id"],
        },
        {
          fields: ["client_id"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return TrainingRegistration;
};
