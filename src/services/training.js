// Seat counting shared by courses (public dates, admin overview) and bookings (capacity checks)
const { Op } = require("sequelize");
const { TrainingBooking, sequelize } = require("../models");

// Map of session id → seats held by pending, confirmed and attended bookings
const seatsTaken = async (sessionIds, { transaction, excludeBookingId } = {}) => {
  const ids = [...new Set(sessionIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const where = { session_id: { [Op.in]: ids }, status: { [Op.in]: TrainingBooking.SEAT_HOLDING } };
  if (excludeBookingId) where.id = { [Op.ne]: excludeBookingId };
  const rows = await TrainingBooking.findAll({
    where,
    attributes: ["session_id", [sequelize.fn("SUM", sequelize.col("participants")), "taken"]],
    group: ["session_id"],
    raw: true,
    transaction,
  });
  return new Map(rows.map((row) => [row.session_id, Number(row.taken) || 0]));
};

const sessionView = (session, taken = 0) => {
  const s = session.get ? session.get({ plain: true }) : session;
  return {
    id: s.id,
    start_date: s.start_date,
    end_date: s.end_date,
    location: s.location,
    fee: s.fee,
    capacity: s.capacity,
    seats_taken: taken,
    seats_left: Math.max(0, s.capacity - taken),
    status: s.status,
  };
};

module.exports = { seatsTaken, sessionView };
