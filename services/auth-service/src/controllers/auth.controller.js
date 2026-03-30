const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// ── Helper: generate tokens ────────────────────────────────────────────────
const generateTokens = (user) => {
  const payload = { userId: user.user_id, email: user.email, role: user.role };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN) || 3600,
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 604800, // 7 days
  });

  return { accessToken, refreshToken };
};

// ── POST /auth/register ────────────────────────────────────────────────────
// Allowed roles each admin type can create
const allowedRolesPerAdmin = {
  hospital_admin: ['hospital_admin', 'ambulance_driver'],
  police_admin:   ['police_admin'],
  fire_admin:     ['fire_admin'],
};

const register = async (req, res) => {
  try {
    const callerRole = req.user.role;
    let { name, email, password, role, station_id } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }

    // Non-system_admin admins are scoped to their own domain
    if (callerRole !== 'system_admin') {
      const permitted = allowedRolesPerAdmin[callerRole] || [];
      if (!permitted.includes(role)) {
        return res.status(403).json({
          message: `You can only create users with roles: ${permitted.join(', ')}`,
        });
      }

      // Force new user into the caller's station
      const caller = await User.findByPk(req.user.userId, { attributes: ['station_id'] });
      if (!caller || !caller.station_id) {
        return res.status(400).json({ message: 'Your account has no station_id — cannot assign new user to a station' });
      }
      station_id = caller.station_id;
    }

    // Check if email already exists
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({ name, email, password_hash, role, station_id });

    return res.status(201).json({
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      station_id: user.station_id,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

// ── POST /auth/login ───────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ where: { email, is_active: true } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    const { accessToken, refreshToken } = generateTokens(user);

    return res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN) || 3600,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

// ── POST /auth/refresh-token ───────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Make sure user still exists and is active
    const user = await User.findOne({ where: { user_id: decoded.userId, is_active: true } });
    if (!user) {
      return res.status(401).json({ message: 'User not found or deactivated' });
    }

    const tokens = generateTokens(user);

    return res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN) || 3600,
    });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

// ── GET /auth/profile ──────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { user_id: req.user.userId, is_active: true },
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Profile error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /auth/users ────────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { role: callerRole, userId: callerId } = req.user;

    let where = {};

    if (callerRole === 'hospital_admin') {
      // Fetch the caller's own station_id from DB
      const caller = await User.findByPk(callerId, { attributes: ['station_id'] });
      if (!caller || !caller.station_id) {
        return res.status(400).json({ message: 'Your account has no station_id assigned' });
      }
      where = { station_id: caller.station_id };
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Get users error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /auth/users/:id ────────────────────────────────────────────────────
const editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const callerRole = req.user.role;
    const { name, email, station_id } = req.body;

    const target = await User.findByPk(id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    // Non-system_admin can only edit users within their own station
    if (callerRole !== 'system_admin') {
      const caller = await User.findByPk(req.user.userId, { attributes: ['station_id'] });
      if (!caller || !caller.station_id) {
        return res.status(400).json({ message: 'Your account has no station_id assigned' });
      }
      if (target.station_id !== caller.station_id) {
        return res.status(403).json({ message: 'You can only edit users within your station' });
      }
    }

    // Only allow safe fields — role changes go through PUT /users/:id/role
    const updates = {};
    if (name)       updates.name       = name;
    if (email)      updates.email      = email;
    if (station_id) updates.station_id = station_id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided to update (name, email, station_id)' });
    }

    // Check email uniqueness if changing email
    if (email && email !== target.email) {
      const taken = await User.findOne({ where: { email } });
      if (taken) return res.status(409).json({ message: 'Email already in use' });
    }

    await target.update(updates);

    return res.status(200).json({
      message: 'User updated',
      user: {
        user_id:    target.user_id,
        name:       target.name,
        email:      target.email,
        role:       target.role,
        station_id: target.station_id,
        updated_at: target.updated_at,
      },
    });
  } catch (error) {
    console.error('Edit user error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /auth/users/:id/role ───────────────────────────────────────────────
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update({ role });
    return res.status(200).json({ message: 'Role updated', userId: id, role });
  } catch (error) {
    console.error('Update role error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login, refreshToken, getProfile, getAllUsers, editUser, updateRole };
