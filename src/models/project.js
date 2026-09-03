const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Project = sequelize.define(
    "Project",
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
        allowNull: false,
        references: { model: "services", key: "id" },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM(
          "planned",
          "in_progress",
          "completed",
          "on_hold"
        ),
        allowNull: false,
        defaultValue: "planned",
      },
    },
    {
      tableName: "projects",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["slug"],
        },
        {
          fields: ["client_id"],
        },
        {
          fields: ["service_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["featured"],
        },
      ],
    }
  );

  return Project;
};
