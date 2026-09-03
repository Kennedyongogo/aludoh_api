const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Certificate = sequelize.define(
    "Certificate",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      registration_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: "training_registrations", key: "id" },
      },
      certificate_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      issued_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("issued", "revoked"),
        allowNull: false,
        defaultValue: "issued",
      },
    },
    {
      tableName: "certificates",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["registration_id"],
        },
        {
          unique: true,
          fields: ["certificate_number"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return Certificate;
};
