const { ServiceRequest, Client, Service } = require("../models");
const { findOrCreateClient } = require("../services/clientService");
const { Op } = require("sequelize");

const requestInclude = [
  { model: Client, as: "client" },
  { model: Service, as: "service" },
];

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      service_id,
      client_id,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (service_id) where.service_id = service_id;
    if (client_id) where.client_id = client_id;
    if (search) {
      where[Op.or] = [
        { description: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where,
      include: requestInclude,
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
    console.error("serviceRequest list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list service requests" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await ServiceRequest.findByPk(req.params.id, {
      include: requestInclude,
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Service request not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("serviceRequest get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch service request" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      client_id,
      service_id,
      location,
      description,
      status,
      name,
      phone,
      email,
      organization,
    } = req.body;

    let resolvedClientId = client_id;
    if (!resolvedClientId) {
      if (!name || !phone)
        return res.status(400).json({
          success: false,
          message: "client_id or name and phone are required",
        });

      const client = await findOrCreateClient({
        name,
        phone,
        email,
        organization,
        location,
      });
      resolvedClientId = client.id;
    }

    const row = await ServiceRequest.create({
      client_id: resolvedClientId,
      service_id: service_id || null,
      location: location || null,
      description: description || null,
      status: status || "new",
    });

    const created = await ServiceRequest.findByPk(row.id, {
      include: requestInclude,
    });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("serviceRequest create error:", err);
    if (err.status === 400)
      return res.status(400).json({ success: false, message: err.message });
    return res
      .status(500)
      .json({ success: false, message: "Failed to create service request" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await ServiceRequest.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Service request not found" });

    const allowed = [
      "client_id",
      "service_id",
      "location",
      "description",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await row.update(updates);
    const updated = await ServiceRequest.findByPk(row.id, {
      include: requestInclude,
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("serviceRequest update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update service request" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await ServiceRequest.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Service request not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("serviceRequest delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete service request" });
  }
};
