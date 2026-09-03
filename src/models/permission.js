const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Permission = sequelize.define(
    "Permission",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "permissions",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["code"],
        },
      ],
    }
  );

  return Permission;
};
