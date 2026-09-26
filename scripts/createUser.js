// Creates an admin user, or resets the name/password if the email already exists.
// Usage: npm run create:user -- "Full Name" email@example.com password [phone]
const bcrypt = require("bcryptjs");
const { User, sequelize } = require("../src/models");

const [name, rawEmail, password, phone] = process.argv.slice(2);

(async () => {
  if (!name || !rawEmail || !password) {
    console.error('Usage: npm run create:user -- "Full Name" email@example.com password [phone]');
    process.exitCode = 1;
    return;
  }

  const email = rawEmail.trim().toLowerCase();

  try {
    await sequelize.authenticate();
    await User.sync({ force: false, alter: false });

    const hashedPassword = await bcrypt.hash(password, 10);
    const existing = await User.findOne({ where: { email } });

    if (existing) {
      await existing.update({ name, password: hashedPassword, ...(phone && { phone }) });
      console.log(`Updated existing user ${email} (id ${existing.id})`);
    } else {
      const user = await User.create({ name, email, password: hashedPassword, phone: phone || null });
      console.log(`Created user ${email} (id ${user.id})`);
    }
  } catch (error) {
    console.error("Failed to create user:", error.parent?.message || error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
