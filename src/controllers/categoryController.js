const { Category, Article } = require("../models");
const { Op } = require("sequelize");
const { slugify, isUuid } = require("../utils/slug");

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Category.findAndCountAll({
      where,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
      order: [[sortBy, sortOrder]],
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
    console.error("category list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list categories" });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const where = isUuid(id) ? { id } : { slug: id };
    const row = await Category.findOne({
      where,
      include: [{ model: Article, as: "articles" }],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("category get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch category" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, slug, description, status } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "name is required" });

    const row = await Category.create({
      name,
      slug: slug || slugify(name),
      description: description || null,
      status: status || "active",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("category create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create category" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Category.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    const allowed = ["name", "slug", "description", "status"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.name && !updates.slug) updates.slug = slugify(updates.name);

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("category update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update category" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Category.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("category delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete category" });
  }
};
