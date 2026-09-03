const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Media = sequelize.define(
    "Media",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      gallery_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "galleries", key: "id" },
      },
      uploaded_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
      },
      file_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      file_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      file_type: {
        type: DataTypes.ENUM("image", "video", "document"),
        allowNull: false,
        defaultValue: "image",
      },
      caption: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      alt_text: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "media",
      timestamps: true,
      indexes: [
        {
          fields: ["gallery_id"],
        },
        {
          fields: ["uploaded_by"],
        },
        {
          fields: ["file_type"],
        },
      ],
    }
  );

  return Media;
};
