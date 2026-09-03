const { Gallery, Media } = require("../models");
const { Op } = require("sequelize");
const { slugify, isUuid } = require("../utils/slug");
const { uploadedPath } = require("../utils/filePath");

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
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Gallery.findAndCountAll({
      where,
      include: [{ model: Media, as: "media" }],
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
    console.error("gallery list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list galleries" });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const where = isUuid(id) ? { id } : { slug: id };
    const row = await Gallery.findOne({
      where,
      include: [{ model: Media, as: "media" }],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Gallery not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("gallery get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch gallery" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, slug, description, cover_image, status } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "name is required" });

    const row = await Gallery.create({
      name,
      slug: slug || slugify(name),
      description: description || null,
      cover_image: uploadedPath(req.file) || cover_image || null,
      status: status || "active",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("gallery create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create gallery" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Gallery.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Gallery not found" });

    const allowed = ["name", "slug", "description", "cover_image", "status"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.name && !updates.slug) updates.slug = slugify(updates.name);
    if (req.file) updates.cover_image = uploadedPath(req.file);

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("gallery update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update gallery" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Gallery.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Gallery not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("gallery delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete gallery" });
  }
};
