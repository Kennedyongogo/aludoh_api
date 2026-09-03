const { Permission, Role } = require("../models");
const { Op } = require("sequelize");

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Permission.findAndCountAll({
      where,
      include: [{ model: Role, as: "roles" }],
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
    console.error("permission list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list permissions" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await Permission.findByPk(req.params.id, {
      include: [{ model: Role, as: "roles" }],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Permission not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("permission get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch permission" });
  }
};

exports.create = async (req, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name)
      return res
        .status(400)
        .json({ success: false, message: "code and name are required" });

    const row = await Permission.create({
      code: String(code).toUpperCase(),
      name,
      description: description || null,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("permission create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create permission" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Permission.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Permission not found" });

    const allowed = ["code", "name", "description"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.code) updates.code = String(updates.code).toUpperCase();

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("permission update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update permission" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Permission.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Permission not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("permission delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete permission" });
  }
};
