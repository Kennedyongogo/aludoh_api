const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const RolePermission = sequelize.define(
    "RolePermission",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "roles", key: "id" },
      },
      permission_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "permissions", key: "id" },
      },
    },
    {
      tableName: "role_permissions",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["role_id", "permission_id"],
        },
        {
          fields: ["role_id"],
        },
        {
          fields: ["permission_id"],
        },
      ],
    }
  );

  return RolePermission;
};
