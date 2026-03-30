const Vehicle = require('../models/vehicle.model');
const LocationHistory = require('../models/location.model');
const { publishEvent } = require('../config/queue');

// ── POST /vehicles/register ───────────────────────────────────────────────
const registerVehicle = async (req, res) => {
  try {
    const { vehicle_id, station_id, vehicle_type, latitude, longitude } = req.body;

    if (!vehicle_id || !station_id || !vehicle_type) {
      return res.status(400).json({ message: 'vehicle_id, station_id and vehicle_type are required' });
    }

    const existing = await Vehicle.findByPk(vehicle_id);
    if (existing) {
      return res.status(409).json({ message: 'Vehicle already registered' });
    }

    const vehicle = await Vehicle.create({
      vehicle_id,
      station_id,
      vehicle_type,
      latitude: latitude || 5.6037,
      longitude: longitude || -0.1870,
      status: 'available',
    });

    return res.status(201).json(vehicle);
  } catch (error) {
    console.error('Register vehicle error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /vehicles ─────────────────────────────────────────────────────────
const getAllVehicles = async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.vehicle_type = type;

    const vehicles = await Vehicle.findAll({ where });
    return res.status(200).json(vehicles);
  } catch (error) {
    console.error('Get vehicles error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /vehicles/:id ─────────────────────────────────────────────────────
const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    return res.status(200).json(vehicle);
  } catch (error) {
    console.error('Get vehicle error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /vehicles/:id/location ────────────────────────────────────────────
const getVehicleLocation = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id, {
      attributes: ['vehicle_id', 'latitude', 'longitude', 'speed_kmh', 'status', 'last_updated'],
    });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    return res.status(200).json(vehicle);
  } catch (error) {
    console.error('Get location error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /vehicles/:id/location ───────────────────────────────────────────
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, speed_kmh } = req.body;
    const { id } = req.params;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'latitude and longitude are required' });
    }

    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // Update vehicle location
    await vehicle.update({ latitude, longitude, speed_kmh, last_updated: new Date() });

    // Save to location history
    await LocationHistory.create({
      vehicle_id: id,
      incident_id: vehicle.incident_id,
      latitude,
      longitude,
      speed_kmh,
    });

    // Publish location update event
    await publishEvent('location.updated', {
      vehicleId: id,
      incidentId: vehicle.incident_id,
      latitude,
      longitude,
      speedKmh: speed_kmh,
    });

    // Broadcast via WebSocket to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('location_update', {
        vehicleId: id,
        incidentId: vehicle.incident_id,
        latitude,
        longitude,
        speed_kmh,
        timestamp: new Date(),
      });
    }

    return res.status(200).json({ message: 'Location updated', vehicleId: id, latitude, longitude });
  } catch (error) {
    console.error('Update location error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /vehicles/:id/status ──────────────────────────────────────────────
const updateVehicleStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'dispatched', 'en_route', 'on_scene', 'returning'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    await vehicle.update({ status });
    return res.status(200).json({ message: 'Status updated', vehicleId: req.params.id, status });
  } catch (error) {
    console.error('Update status error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /vehicles/:id/history ─────────────────────────────────────────────
const getLocationHistory = async (req, res) => {
  try {
    const history = await LocationHistory.findAll({
      where: { vehicle_id: req.params.id },
      order: [['recorded_at', 'DESC']],
      limit: 100,
    });
    return res.status(200).json(history);
  } catch (error) {
    console.error('Get history error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /dispatch/:incidentId/track ──────────────────────────────────────
const trackIncident = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({
      where: { incident_id: req.params.incidentId },
    });
    if (!vehicle) return res.status(404).json({ message: 'No vehicle assigned to this incident' });

    const history = await LocationHistory.findAll({
      where: { incident_id: req.params.incidentId },
      order: [['recorded_at', 'ASC']],
    });

    return res.status(200).json({ vehicle, locationHistory: history });
  } catch (error) {
    console.error('Track incident error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerVehicle, getAllVehicles, getVehicleById,
  getVehicleLocation, updateLocation, updateVehicleStatus,
  getLocationHistory, trackIncident,
};
