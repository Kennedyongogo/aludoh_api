const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ProjectImage = sequelize.define(
    "ProjectImage",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "projects", key: "id" },
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      caption: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "project_images",
      timestamps: true,
      indexes: [
        {
          fields: ["project_id"],
        },
        {
          fields: ["project_id", "sort_order"],
        },
      ],
    }
  );

  return ProjectImage;
};
