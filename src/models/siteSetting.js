const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SiteSetting = sequelize.define(
    "SiteSetting",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      company_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { isEmail: true },
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      whatsapp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      facebook: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      instagram: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      twitter: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      youtube: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      footer_text: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      maps_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      maps_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
    },
    {
      tableName: "site_settings",
      timestamps: true,
    }
  );

  return SiteSetting;
};
