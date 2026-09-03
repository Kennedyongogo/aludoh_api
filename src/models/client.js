const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Client = sequelize.define(
    "Client",
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
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { isEmail: true },
      },
      organization: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      tableName: "clients",
      timestamps: true,
      indexes: [
        {
          fields: ["phone"],
        },
        {
          fields: ["email"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return Client;
};
