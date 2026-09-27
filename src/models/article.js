const { DataTypes } = require("sequelize");

const STATUSES = ["draft", "published"];

// A Knowledge Center article on /blog and /blog/:slug.
// content is plain text: "## " starts a heading and "- " a bullet point.
module.exports = (sequelize) => {
  const Article = sequelize.define(
    "Article",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      excerpt: {
        type: DataTypes.STRING(400),
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      featured_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      author_name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      author_role: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "draft",
        validate: { isIn: [STATUSES] },
      },
      // A future date keeps a published article hidden until then
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      seo_title: {
        type: DataTypes.STRING(70),
        allowNull: true,
      },
      seo_description: {
        type: DataTypes.STRING(170),
        allowNull: true,
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
      tableName: "knowledge_articles",
      timestamps: true,
      paranoid: true,
      indexes: [
        { unique: true, fields: ["slug"] },
        { fields: ["status", "published_at"] },
        { fields: ["category"] },
      ],
    }
  );

  Article.STATUSES = STATUSES;

  return Article;
};
