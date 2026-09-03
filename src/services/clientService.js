const { Client } = require("../models");
const { validatePhoneNumber, normalizePhoneNumber } = require("../utils/phone");

const normalizeKenyanPhone = (input) => {
  const stripped = normalizePhoneNumber(input);
  if (/^0[17]\d{8}$/.test(stripped)) {
    return `+254${stripped.slice(1)}`;
  }
  return stripped;
};

const validateClientPhone = (input) => {
  const localNormalized = normalizeKenyanPhone(input);
  return validatePhoneNumber(localNormalized || input);
};

const findOrCreateClient = async ({
  name,
  phone,
  email,
  organization,
  location,
}) => {
  const phoneCheck = phone ? validateClientPhone(phone) : { valid: true, normalized: null };
  if (phone && !phoneCheck.valid) {
    const error = new Error(phoneCheck.message);
    error.status = 400;
    throw error;
  }

  const normalizedPhone = phoneCheck.normalized || phone;

  if (normalizedPhone) {
    const byPhone = await Client.findOne({ where: { phone: normalizedPhone } });
    if (byPhone) return byPhone;
  }

  if (email) {
    const byEmail = await Client.findOne({ where: { email } });
    if (byEmail) return byEmail;
  }

  return Client.create({
    name,
    phone: normalizedPhone,
    email: email || null,
    organization: organization || null,
    location: location || null,
    status: "active",
  });
};

module.exports = {
  findOrCreateClient,
  validateClientPhone,
};
