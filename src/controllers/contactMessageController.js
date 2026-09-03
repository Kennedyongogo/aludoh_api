const { ContactMessage } = require("../models");
const { Op } = require("sequelize");

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
        { email: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ContactMessage.findAndCountAll({
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
    console.error("contactMessage list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list contact messages" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await ContactMessage.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Contact message not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("contactMessage get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch contact message" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({
        success: false,
        message: "name, email, and message are required",
      });

    const row = await ContactMessage.create({
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
      status: "unread",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("contactMessage create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create contact message" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await ContactMessage.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Contact message not found" });

    const allowed = ["name", "email", "phone", "subject", "message", "status"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("contactMessage update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update contact message" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await ContactMessage.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Contact message not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("contactMessage delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete contact message" });
  }
};
