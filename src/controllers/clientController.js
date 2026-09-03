const { Client, ServiceRequest, Project, TrainingRegistration } = require("../models");
const { Op } = require("sequelize");
const { validateClientPhone } = require("../services/clientService");

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
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { organization: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Client.findAndCountAll({
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
    console.error("client list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list clients" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await Client.findByPk(req.params.id, {
      include: [
        { model: ServiceRequest, as: "serviceRequests" },
        { model: Project, as: "projects" },
        { model: TrainingRegistration, as: "trainingRegistrations" },
      ],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("client get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch client" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, phone, email, organization, location, status } = req.body;
    if (!name || !phone)
      return res
        .status(400)
        .json({ success: false, message: "name and phone are required" });

    const phoneCheck = validateClientPhone(phone);
    if (!phoneCheck.valid)
      return res
        .status(400)
        .json({ success: false, message: phoneCheck.message });

    const row = await Client.create({
      name,
      phone: phoneCheck.normalized,
      email: email || null,
      organization: organization || null,
      location: location || null,
      status: status || "active",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("client create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create client" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Client.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });

    const allowed = [
      "name",
      "phone",
      "email",
      "organization",
      "location",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.phone) {
      const phoneCheck = validateClientPhone(updates.phone);
      if (!phoneCheck.valid)
        return res
          .status(400)
          .json({ success: false, message: phoneCheck.message });
      updates.phone = phoneCheck.normalized;
    }

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("client update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update client" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Client.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("client delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete client" });
  }
};
