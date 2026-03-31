const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
require('dotenv').config();

const vehicleRoutes = require('./routes/vehicle.routes');
const { connectDB } = require('./config/db');
const { connectQueue, subscribeToEvent } = require('./config/queue');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Swagger docs — available at /api-docs
const swaggerDoc = yaml.load(fs.readFileSync(`${__dirname}/swagger.yaml`, 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Make io accessible in controllers
app.set('io', io);

// Routes
app.use('/', vehicleRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'dispatch-service', timestamp: new Date() });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (data) => {
    const room = `vehicle_${data.vehicleId}`;
    socket.join(room);
    console.log(`Client subscribed to ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3003;

const start = async () => {
  await connectDB();
  const channel = await connectQueue();

  if (channel) {
    // Subscribe to incident.created — mark vehicle as dispatched
    await subscribeToEvent('incident.created', async (event) => {
      try {
        const Vehicle = require('./models/vehicle.model');
        const { assignedUnitId, incidentId } = event.payload;
        if (assignedUnitId) {
          await Vehicle.update(
            { status: 'dispatched', incident_id: incidentId },
            { where: { vehicle_id: assignedUnitId } }
          );
          console.log(`Vehicle ${assignedUnitId} marked as dispatched for incident ${incidentId}`);
        }
      } catch (err) {
        console.error('Error handling incident.created:', err.message);
      }
    });

    // Subscribe to incident.resolved — free the vehicle back to available
    await subscribeToEvent('incident.resolved', async (event) => {
      try {
        const Vehicle = require('./models/vehicle.model');
        const { incidentId } = event.payload;
        await Vehicle.update(
          { status: 'available', incident_id: null },
          { where: { incident_id: incidentId } }
        );
        console.log(`Vehicle freed back to available for resolved incident ${incidentId}`);
      } catch (err) {
        console.error('Error handling incident.resolved:', err.message);
      }
    });
  }

  server.listen(PORT, () => {
    console.log(`Dispatch Service running on port ${PORT}`);
    console.log(`WebSocket server ready on ws://localhost:${PORT}`);
  });
};

start();

module.exports = app;
