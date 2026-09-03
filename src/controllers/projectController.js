const { Project, ProjectImage, Client, Service } = require("../models");
const { Op } = require("sequelize");
const { slugify, isUuid } = require("../utils/slug");

const projectInclude = [
  { model: Client, as: "client" },
  { model: Service, as: "service" },
  { model: ProjectImage, as: "images" },
];

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      featured,
      client_id,
      service_id,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (featured !== undefined) where.featured = featured === "true";
    if (client_id) where.client_id = client_id;
    if (service_id) where.service_id = service_id;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Project.findAndCountAll({
      where,
      include: projectInclude,
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
    console.error("project list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list projects" });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const where = isUuid(id) ? { id } : { slug: id };
    const row = await Project.findOne({
      where,
      include: projectInclude,
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("project get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch project" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      client_id,
      service_id,
      name,
      slug,
      location,
      description,
      featured,
      status,
    } = req.body;
    if (!client_id || !service_id || !name)
      return res.status(400).json({
        success: false,
        message: "client_id, service_id, and name are required",
      });

    const row = await Project.create({
      client_id,
      service_id,
      name,
      slug: slug || slugify(name),
      location: location || null,
      description: description || null,
      featured: !!featured,
      status: status || "planned",
    });

    const created = await Project.findByPk(row.id, { include: projectInclude });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("project create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create project" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Project.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    const allowed = [
      "client_id",
      "service_id",
      "name",
      "slug",
      "location",
      "description",
      "featured",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.name && !updates.slug) updates.slug = slugify(updates.name);

    await row.update(updates);
    const updated = await Project.findByPk(row.id, { include: projectInclude });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("project update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update project" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Project.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("project delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete project" });
  }
};
