const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ServiceRequest = sequelize.define(
    "ServiceRequest",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      client_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "clients", key: "id" },
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "services", key: "id" },
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(
          "new",
          "in_progress",
          "quoted",
          "won",
          "lost",
          "closed"
        ),
        allowNull: false,
        defaultValue: "new",
      },
    },
    {
      tableName: "service_requests",
      timestamps: true,
      indexes: [
        {
          fields: ["client_id"],
        },
        {
          fields: ["service_id"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return ServiceRequest;
};
