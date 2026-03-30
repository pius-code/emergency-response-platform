const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LocationHistory = sequelize.define('LocationHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  vehicle_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  incident_id: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  speed_kmh: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  recorded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'location_history',
  timestamps: false,
});

module.exports = LocationHistory;
