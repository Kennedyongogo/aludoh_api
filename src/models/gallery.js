const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Gallery = sequelize.define(
    "Gallery",
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
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cover_image: {
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
      tableName: "galleries",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["slug"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return Gallery;
};
