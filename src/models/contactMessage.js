const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ContactMessage = sequelize.define(
    "ContactMessage",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isEmail: true },
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("unread", "read", "responded", "closed"),
        allowNull: false,
        defaultValue: "unread",
      },
    },
    {
      tableName: "contact_messages",
      timestamps: true,
      indexes: [
        {
          fields: ["status"],
        },
        {
          fields: ["email"],
        },
      ],
    }
  );

  return ContactMessage;
};
