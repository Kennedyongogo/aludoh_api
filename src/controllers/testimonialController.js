const { Testimonial, Client } = require("../models");
const { Op } = require("sequelize");
const { uploadedPath } = require("../utils/filePath");

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      client_id,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (client_id) where.client_id = client_id;
    if (search) {
      where[Op.or] = [
        { client_name: { [Op.iLike]: `%${search}%` } },
        { organization: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Testimonial.findAndCountAll({
      where,
      include: [{ model: Client, as: "client" }],
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
    console.error("testimonial list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list testimonials" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await Testimonial.findByPk(req.params.id, {
      include: [{ model: Client, as: "client" }],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("testimonial get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch testimonial" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      client_id,
      client_name,
      organization,
      content,
      photo,
      rating,
      status,
    } = req.body;
    if (!client_name || !content)
      return res.status(400).json({
        success: false,
        message: "client_name and content are required",
      });

    const row = await Testimonial.create({
      client_id: client_id || null,
      client_name,
      organization: organization || null,
      content,
      photo: uploadedPath(req.file) || photo || null,
      rating: rating || null,
      status: status || "pending",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("testimonial create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create testimonial" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Testimonial.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });

    const allowed = [
      "client_id",
      "client_name",
      "organization",
      "content",
      "photo",
      "rating",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.file) updates.photo = uploadedPath(req.file);

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("testimonial update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update testimonial" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Testimonial.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("testimonial delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete testimonial" });
  }
};
