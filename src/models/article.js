const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Article = sequelize.define(
    "Article",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      author_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      category_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "categories", key: "id" },
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      excerpt: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      featured_image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("draft", "published", "archived"),
        allowNull: false,
        defaultValue: "draft",
      },
    },
    {
      tableName: "articles",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["slug"],
        },
        {
          fields: ["author_id"],
        },
        {
          fields: ["category_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["published_at"],
        },
      ],
    }
  );

  return Article;
};
