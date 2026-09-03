const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Service = sequelize.define(
    "Service",
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
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      short_description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      tableName: "services",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["slug"],
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

  return Service;
};
