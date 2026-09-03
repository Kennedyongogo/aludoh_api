const { Article, Category, User } = require("../models");
const { Op } = require("sequelize");
const { slugify, isUuid } = require("../utils/slug");
const { uploadedPath } = require("../utils/filePath");

const articleInclude = [
  { model: Category, as: "category" },
  { model: User, as: "author", attributes: { exclude: ["password"] } },
];

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category_id,
      author_id,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (category_id) where.category_id = category_id;
    if (author_id) where.author_id = author_id;
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { excerpt: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Article.findAndCountAll({
      where,
      include: articleInclude,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
      order: [[sortBy, sortOrder]],
      distinct: true,
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    console.error("article list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list articles" });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const where = isUuid(id) ? { id } : { slug: id };
    const row = await Article.findOne({
      where,
      include: articleInclude,
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("article get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch article" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      author_id,
      category_id,
      title,
      slug,
      excerpt,
      content,
      featured_image,
      published_at,
      status,
    } = req.body;
    if (!title || !category_id)
      return res.status(400).json({
        success: false,
        message: "title and category_id are required",
      });

    const resolvedStatus = status || "draft";
    const row = await Article.create({
      author_id: author_id || req.userId,
      category_id,
      title,
      slug: slug || slugify(title),
      excerpt: excerpt || null,
      content: content || null,
      featured_image: uploadedPath(req.file) || featured_image || null,
      published_at:
        published_at || (resolvedStatus === "published" ? new Date() : null),
      status: resolvedStatus,
    });

    const created = await Article.findByPk(row.id, { include: articleInclude });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("article create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create article" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Article.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });

    const allowed = [
      "author_id",
      "category_id",
      "title",
      "slug",
      "excerpt",
      "content",
      "featured_image",
      "published_at",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.title && !updates.slug) updates.slug = slugify(updates.title);
    if (req.file) updates.featured_image = uploadedPath(req.file);
    if (updates.status === "published" && !row.published_at && !updates.published_at) {
      updates.published_at = new Date();
    }

    await row.update(updates);
    const updated = await Article.findByPk(row.id, { include: articleInclude });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("article update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update article" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Article.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("article delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete article" });
  }
};
