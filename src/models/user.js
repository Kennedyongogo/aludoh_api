const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "roles", key: "id" },
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      tableName: "users",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["email"],
        },
        {
          fields: ["role_id"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return User;
};
