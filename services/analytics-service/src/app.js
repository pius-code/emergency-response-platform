const express = require('express');
const cors = require('cors');
require('dotenv').config();

const analyticsRoutes = require('./routes/analytics.routes');
const { connectDB } = require('./config/db');
const { connectQueue, subscribeToEvent } = require('./config/queue');
const AnalyticsEvent = require('./models/analytics.model');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/analytics', analyticsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'analytics-service', timestamp: new Date() });
});

const PORT = process.env.PORT || 3004;

const start = async () => {
  await connectDB();
  await connectQueue();

  // Subscribe to incident.created
  await subscribeToEvent('incident.created', async (event) => {
    try {
      await AnalyticsEvent.create({
        event_type: 'incident.created',
        incident_id: event.payload.incidentId,
        incident_type: event.payload.incidentType,
        service_type: event.payload.assignedUnitType,
        unit_id: event.payload.assignedUnitId,
        latitude: event.payload.latitude,
        longitude: event.payload.longitude,
      });
      console.log(`Recorded: incident.created — ${event.payload.incidentId}`);
    } catch (err) {
      console.error('Error recording incident.created:', err.message);
    }
  });

  // Subscribe to unit.dispatched
  await subscribeToEvent('unit.dispatched', async (event) => {
    try {
      await AnalyticsEvent.create({
        event_type: 'unit.dispatched',
        incident_id: event.payload.incidentId,
        service_type: event.payload.unitType,
        unit_id: event.payload.unitId,
      });
      console.log(`Recorded: unit.dispatched — ${event.payload.unitId}`);
    } catch (err) {
      console.error('Error recording unit.dispatched:', err.message);
    }
  });

  // Subscribe to incident.resolved
  await subscribeToEvent('incident.resolved', async (event) => {
    try {
      await AnalyticsEvent.create({
        event_type: 'incident.resolved',
        incident_id: event.payload.incidentId,
        response_time_s: event.payload.responseTimeSeconds,
        resolved: true,
      });
      console.log(`Recorded: incident.resolved — ${event.payload.incidentId}`);
    } catch (err) {
      console.error('Error recording incident.resolved:', err.message);
    }
  });

  // Subscribe to location.updated
  await subscribeToEvent('location.updated', async (event) => {
    try {
      await AnalyticsEvent.create({
        event_type: 'location.updated',
        incident_id: event.payload.incidentId,
        unit_id: event.payload.vehicleId,
        latitude: event.payload.latitude,
        longitude: event.payload.longitude,
      });
    } catch (err) {
      console.error('Error recording location.updated:', err.message);
    }
  });

  app.listen(PORT, () => console.log(`Analytics Service running on port ${PORT}`));
};

start();

module.exports = app;
