const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AnalyticsEvent = sequelize.define('AnalyticsEvent', {
  event_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  incident_id: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  incident_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  service_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  unit_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  response_time_s: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  recorded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'analytics_events',
  timestamps: false,
});

module.exports = AnalyticsEvent;
