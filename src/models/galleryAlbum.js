const { DataTypes } = require("sequelize");

// An album on /gallery; its photos live in a JSON list so they can be reordered in one save
module.exports = (sequelize) => {
  const GalleryAlbum = sequelize.define(
    "GalleryAlbum",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      // Falls back to the first photo when empty
      cover_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      // [{ url, caption }]
      photos: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
    },
    {
      tableName: "gallery_albums",
      timestamps: true,
      paranoid: true,
      indexes: [{ unique: true, fields: ["slug"] }, { fields: ["is_published", "sort_order"] }],
    }
  );

  return GalleryAlbum;
};
