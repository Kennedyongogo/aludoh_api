const { Role, Permission, RolePermission, User } = require("../models");
const { Op } = require("sequelize");
const { slugify } = require("../utils/slug");

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

    const { count, rows } = await Role.findAndCountAll({
      where,
      include: [{ model: Permission, as: "permissions" }],
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
    console.error("role list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list roles" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await Role.findByPk(req.params.id, {
      include: [
        { model: Permission, as: "permissions" },
        { model: User, as: "users", attributes: { exclude: ["password"] } },
      ],
    });
    if (!row)
      return res.status(404).json({ success: false, message: "Role not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("role get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch role" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, slug, description, status } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "name is required" });

    const row = await Role.create({
      name,
      slug: slug || slugify(name),
      description: description || null,
      status: status || "active",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("role create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create role" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Role.findByPk(req.params.id);
    if (!row)
      return res.status(404).json({ success: false, message: "Role not found" });

    const allowed = ["name", "slug", "description", "status"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.name && !updates.slug) updates.slug = slugify(updates.name);

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("role update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update role" });
  }
};

exports.setPermissions = async (req, res) => {
  try {
    const row = await Role.findByPk(req.params.id);
    if (!row)
      return res.status(404).json({ success: false, message: "Role not found" });

    const permissionIds = req.body.permission_ids || [];
    await RolePermission.destroy({ where: { role_id: row.id } });
    if (permissionIds.length) {
      await RolePermission.bulkCreate(
        permissionIds.map((permission_id) => ({
          role_id: row.id,
          permission_id,
        }))
      );
    }

    const updated = await Role.findByPk(row.id, {
      include: [{ model: Permission, as: "permissions" }],
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("role setPermissions error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update role permissions" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Role.findByPk(req.params.id);
    if (!row)
      return res.status(404).json({ success: false, message: "Role not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("role delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete role" });
  }
};
