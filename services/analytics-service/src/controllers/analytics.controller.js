const { Op, fn, col, literal } = require('sequelize');
const AnalyticsEvent = require('../models/analytics.model');

// ── Helper: date range from query params ──────────────────────────────────
const getDateRange = (query) => {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { [Op.between]: [from, to] };
};

// ── GET /analytics/response-times ─────────────────────────────────────────
const getResponseTimes = async (req, res) => {
  try {
    const where = {
      event_type: 'incident.resolved',
      response_time_s: { [Op.not]: null },
      recorded_at: getDateRange(req.query),
    };

    if (req.query.incidentType) where.incident_type = req.query.incidentType;
    if (req.query.serviceType) where.service_type = req.query.serviceType;

    const events = await AnalyticsEvent.findAll({ where });

    if (events.length === 0) {
      return res.status(200).json({
        averageResponseTimeMinutes: 0,
        totalResolved: 0,
        breakdown: [],
        period: { from: req.query.from || '30 days ago', to: req.query.to || 'now' },
      });
    }

    const totalSeconds = events.reduce((sum, e) => sum + e.response_time_s, 0);
    const avgMinutes = (totalSeconds / events.length / 60).toFixed(2);

    // Breakdown by incident type
    const breakdown = {};
    events.forEach((e) => {
      const type = e.incident_type || 'unknown';
      if (!breakdown[type]) breakdown[type] = { count: 0, totalSeconds: 0 };
      breakdown[type].count++;
      breakdown[type].totalSeconds += e.response_time_s;
    });

    const breakdownArray = Object.entries(breakdown).map(([type, data]) => ({
      incidentType: type,
      avgMinutes: (data.totalSeconds / data.count / 60).toFixed(2),
      count: data.count,
    }));

    return res.status(200).json({
      averageResponseTimeMinutes: parseFloat(avgMinutes),
      totalResolved: events.length,
      breakdown: breakdownArray,
      period: { from: req.query.from || '30 days ago', to: req.query.to || 'now' },
    });
  } catch (error) {
    console.error('Response times error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /analytics/incidents-by-region ────────────────────────────────────
const getIncidentsByRegion = async (req, res) => {
  try {
    const where = {
      event_type: 'incident.created',
      recorded_at: getDateRange(req.query),
    };

    if (req.query.incidentType) where.incident_type = req.query.incidentType;

    const events = await AnalyticsEvent.findAll({ where });

    // Group by incident type
    const grouped = {};
    events.forEach((e) => {
      const type = e.incident_type || 'unknown';
      if (!grouped[type]) grouped[type] = 0;
      grouped[type]++;
    });

    const result = Object.entries(grouped).map(([type, count]) => ({
      incidentType: type,
      count,
    }));

    return res.status(200).json({
      totalIncidents: events.length,
      breakdown: result,
      period: { from: req.query.from || '30 days ago', to: req.query.to || 'now' },
    });
  } catch (error) {
    console.error('Incidents by region error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /analytics/resource-utilization ───────────────────────────────────
const getResourceUtilization = async (req, res) => {
  try {
    const where = {
      recorded_at: getDateRange(req.query),
    };

    const dispatched = await AnalyticsEvent.count({
      where: { ...where, event_type: 'unit.dispatched' },
    });

    const resolved = await AnalyticsEvent.count({
      where: { ...where, event_type: 'incident.resolved' },
    });

    const created = await AnalyticsEvent.count({
      where: { ...where, event_type: 'incident.created' },
    });

    // Breakdown by service type
    const serviceEvents = await AnalyticsEvent.findAll({
      where: { ...where, event_type: 'unit.dispatched' },
    });

    const byService = {};
    serviceEvents.forEach((e) => {
      const type = e.service_type || 'unknown';
      if (!byService[type]) byService[type] = 0;
      byService[type]++;
    });

    return res.status(200).json({
      totalIncidentsCreated: created,
      totalDispatched: dispatched,
      totalResolved: resolved,
      resolutionRate: created > 0 ? ((resolved / created) * 100).toFixed(1) + '%' : '0%',
      byServiceType: byService,
      period: { from: req.query.from || '30 days ago', to: req.query.to || 'now' },
    });
  } catch (error) {
    console.error('Resource utilization error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /analytics/incidents/summary ──────────────────────────────────────
const getIncidentsSummary = async (req, res) => {
  try {
    const where = { recorded_at: getDateRange(req.query) };

    const total = await AnalyticsEvent.count({ where: { ...where, event_type: 'incident.created' } });
    const resolved = await AnalyticsEvent.count({ where: { ...where, event_type: 'incident.resolved' } });
    const dispatched = await AnalyticsEvent.count({ where: { ...where, event_type: 'unit.dispatched' } });

    return res.status(200).json({
      total,
      dispatched,
      resolved,
      pending: total - resolved,
      period: { from: req.query.from || '30 days ago', to: req.query.to || 'now' },
    });
  } catch (error) {
    console.error('Summary error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getResponseTimes, getIncidentsByRegion, getResourceUtilization, getIncidentsSummary };
