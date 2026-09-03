const { TrainingCourse, TrainingSession } = require("../models");
const { Op } = require("sequelize");
const { slugify, isUuid } = require("../utils/slug");
const { uploadedPath } = require("../utils/filePath");

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      featured,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (featured !== undefined) where.featured = featured === "true";
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { short_description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await TrainingCourse.findAndCountAll({
      where,
      include: [{ model: TrainingSession, as: "sessions" }],
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
    console.error("trainingCourse list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list training courses" });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const where = isUuid(id) ? { id } : { slug: id };
    const row = await TrainingCourse.findOne({
      where,
      include: [{ model: TrainingSession, as: "sessions" }],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Training course not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("trainingCourse get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch training course" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      name,
      slug,
      short_description,
      description,
      image,
      featured,
      status,
    } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "name is required" });

    const row = await TrainingCourse.create({
      name,
      slug: slug || slugify(name),
      short_description: short_description || null,
      description: description || null,
      image: uploadedPath(req.file) || image || null,
      featured: !!featured,
      status: status || "active",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("trainingCourse create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create training course" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await TrainingCourse.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Training course not found" });

    const allowed = [
      "name",
      "slug",
      "short_description",
      "description",
      "image",
      "featured",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.name && !updates.slug) updates.slug = slugify(updates.name);
    if (req.file) updates.image = uploadedPath(req.file);

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("trainingCourse update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update training course" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await TrainingCourse.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Training course not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("trainingCourse delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete training course" });
  }
};
