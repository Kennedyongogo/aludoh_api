const { ServiceGoal, Service } = require("../models");
const v = require("../utils/validation");
const { nextSortOrder, reorder } = require("../utils/content");
const { SERVICE_BRIEF_ATTRIBUTES } = require("../services/contentViews");

const MAX_SERVICES = 4;
const ORDER = [
  ["sort_order", "ASC"],
  ["createdAt", "ASC"],
];

const notFound = (res) => res.status(404).json({ success: false, message: "Goal not found" });

const cleanServiceIds = async (value) => {
  const ids = v.stringList(value, "Services", { maxItems: MAX_SERVICES, maxLength: 36 });
  if (!ids.length) throw new v.ValidationError("Choose at least one service for this goal");
  ids.forEach((id) => v.uuid(id, "Service"));
  if (new Set(ids).size !== ids.length) throw new v.ValidationError("A service is listed twice");

  const found = await Service.count({ where: { id: ids } });
  if (found !== ids.length) throw new v.ValidationError("One of the chosen services no longer exists");
  return ids;
};

// Replaces service_ids with the services themselves, in the saved order
const withServices = async (goals, { activeOnly }) => {
  const ids = [...new Set(goals.flatMap((goal) => goal.service_ids))];
  const where = { id: ids };
  if (activeOnly) where.status = "active";
  const services = await Service.findAll({
    where,
    attributes: [...SERVICE_BRIEF_ATTRIBUTES, "status"],
  });
  const byId = new Map(services.map((service) => [service.id, service.toJSON()]));

  return goals.map((goal) => {
    const { service_ids: serviceIds, ...rest } = goal.toJSON();
    return {
      ...rest,
      service_ids: serviceIds,
      services: serviceIds.map((id) => byId.get(id)).filter(Boolean),
    };
  });
};

// Public: goals for the "Not sure where to start?" finder, best-matching service first
exports.list = async (req, res) => {
  try {
    const goals = await ServiceGoal.findAll({ where: { is_active: true }, order: ORDER });
    const data = (await withServices(goals, { activeOnly: true }))
      .filter((goal) => goal.services.length)
      .map(({ id, label, services }) => ({ id, label, services }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return v.sendError(res, "fetching service goals", error);
  }
};

exports.adminList = async (req, res) => {
  try {
    const goals = await ServiceGoal.findAll({ order: ORDER });
    return res.status(200).json({ success: true, data: await withServices(goals, { activeOnly: false }) });
  } catch (error) {
    return v.sendError(res, "fetching service goals", error);
  }
};

exports.create = async (req, res) => {
  try {
    const goal = await ServiceGoal.create({
      label: v.text(req.body.label, "Goal", { max: 80, required: true }),
      service_ids: await cleanServiceIds(req.body.service_ids),
      is_active: v.boolean(req.body.is_active) ?? true,
      sort_order:
        v.integer(req.body.sort_order, "Sort order", { min: 0, max: 100000 }) ??
        (await nextSortOrder(ServiceGoal)),
    });
    const [data] = await withServices([goal], { activeOnly: false });
    return res.status(201).json({ success: true, message: "Goal created successfully", data });
  } catch (error) {
    return v.sendError(res, "creating service goal", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const goal = await ServiceGoal.findByPk(req.params.id);
    if (!goal) return notFound(res);

    const body = req.body;
    const changes = {};
    if (body.label !== undefined) changes.label = v.text(body.label, "Goal", { max: 80, required: true });
    if (body.service_ids !== undefined) changes.service_ids = await cleanServiceIds(body.service_ids);
    if (body.is_active !== undefined) changes.is_active = v.boolean(body.is_active) ?? false;
    if (body.sort_order !== undefined) {
      changes.sort_order = v.integer(body.sort_order, "Sort order", { min: 0, max: 100000, required: true });
    }
    if (!Object.keys(changes).length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    await goal.update(changes);
    const [data] = await withServices([goal], { activeOnly: false });
    return res.status(200).json({ success: true, message: "Goal updated successfully", data });
  } catch (error) {
    return v.sendError(res, "updating service goal", error);
  }
};

exports.reorder = async (req, res) => {
  try {
    await reorder(ServiceGoal, req.body.ids);
    return res.status(200).json({ success: true, message: "Order saved" });
  } catch (error) {
    return v.sendError(res, "reordering service goals", error);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const removed = await ServiceGoal.destroy({ where: { id: req.params.id } });
    if (!removed) return notFound(res);
    return res.status(200).json({ success: true, message: "Goal deleted successfully" });
  } catch (error) {
    return v.sendError(res, "deleting service goal", error);
  }
};
