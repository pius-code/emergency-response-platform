const Station = require('../models/station.model');
const User = require('../models/user.model');

// Maps caller role to station type
const roleToStationType = {
  hospital_admin: 'hospital',
  police_admin:   'police',
  fire_admin:     'fire',
};

// ── POST /auth/stations ────────────────────────────────────────────────────
const createStation = async (req, res) => {
  try {
    const callerRole = req.user.role;
    const { station_id, name, address, latitude, longitude, total_capacity } = req.body;

    if (!station_id || !name) {
      return res.status(400).json({ message: 'station_id and name are required' });
    }

    // Determine station type from caller's role
    const type = callerRole === 'system_admin'
      ? req.body.type
      : roleToStationType[callerRole];

    if (!type) {
      return res.status(400).json({ message: 'type is required (hospital, police, fire)' });
    }

    const existing = await Station.findByPk(station_id);
    if (existing) {
      return res.status(409).json({ message: 'Station ID already exists' });
    }

    const stationData = { station_id, name, type, address, latitude, longitude };

    // Only hospitals can have capacity
    if (type === 'hospital') {
      stationData.total_capacity     = total_capacity     ?? null;
      stationData.available_capacity = total_capacity     ?? null; // starts fully available
    }

    const station = await Station.create(stationData);

    return res.status(201).json(station);
  } catch (error) {
    console.error('Create station error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /auth/stations ─────────────────────────────────────────────────────
const getStations = async (req, res) => {
  try {
    const callerRole = req.user.role;

    // Determine which station types to return
    let typeFilter = null;
    if (callerRole !== 'system_admin') {
      typeFilter = roleToStationType[callerRole];
    } else if (req.query.type) {
      typeFilter = req.query.type;
    }

    const where = typeFilter ? { type: typeFilter } : {};

    const stations = await Station.findAll({
      where,
      order: [['name', 'ASC']],
    });

    // Attach users to each station
    const userWhere = typeFilter
      ? { role: Object.keys(roleToStationType).filter(r => roleToStationType[r] === typeFilter) }
      : {};

    const users = await User.findAll({
      where: userWhere,
      attributes: { exclude: ['password_hash'] },
    });

    // Group users by station_id
    const usersByStation = {};
    for (const user of users) {
      const sid = user.station_id;
      if (!sid) continue;
      if (!usersByStation[sid]) usersByStation[sid] = [];
      usersByStation[sid].push(user);
    }

    const result = stations.map((s) => ({
      station_id:         s.station_id,
      name:               s.name,
      type:               s.type,
      address:            s.address,
      latitude:           s.latitude,
      longitude:          s.longitude,
      ...(s.type === 'hospital' && {
        total_capacity:     s.total_capacity,
        available_capacity: s.available_capacity,
      }),
      created_at:         s.created_at,
      updated_at:         s.updated_at,
      users:              usersByStation[s.station_id] || [],
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get stations error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /auth/stations/:id/capacity ───────────────────────────────────────
const updateCapacity = async (req, res) => {
  try {
    const { id } = req.params;
    const { total_capacity, available_capacity } = req.body;

    const station = await Station.findByPk(id);
    if (!station) return res.status(404).json({ message: 'Station not found' });

    if (station.type !== 'hospital') {
      return res.status(400).json({ message: 'Capacity only applies to hospital stations' });
    }

    if (total_capacity === undefined && available_capacity === undefined) {
      return res.status(400).json({ message: 'Provide total_capacity or available_capacity' });
    }

    const updates = {};
    if (total_capacity     !== undefined) updates.total_capacity     = total_capacity;
    if (available_capacity !== undefined) updates.available_capacity = available_capacity;

    await station.update(updates);

    return res.status(200).json({
      message:            'Capacity updated',
      station_id:         station.station_id,
      total_capacity:     station.total_capacity,
      available_capacity: station.available_capacity,
    });
  } catch (error) {
    console.error('Update capacity error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createStation, getStations, updateCapacity };
