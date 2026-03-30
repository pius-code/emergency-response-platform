const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Vehicle = sequelize.define('Vehicle', {
  vehicle_id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
  },
  station_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  vehicle_type: {
    type: DataTypes.ENUM('ambulance', 'police_car', 'fire_truck'),
    allowNull: false,
  },
  incident_id: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
    defaultValue: 5.6037,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
    defaultValue: -0.1870,
  },
  speed_kmh: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('available', 'dispatched', 'en_route', 'on_scene', 'returning'),
    defaultValue: 'available',
  },
  last_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'vehicles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Vehicle;
