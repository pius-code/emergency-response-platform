const express = require('express');
const cors = require('cors');
require('dotenv').config();

const incidentRoutes = require('./routes/incident.routes');
const { connectDB } = require('./config/db');
const { connectQueue } = require('./config/queue');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/incidents', incidentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'incident-service', timestamp: new Date() });
});

const PORT = process.env.PORT || 3002;

const start = async () => {
  await connectDB();
  await connectQueue(); // connects to RabbitMQ if available
  app.listen(PORT, () => console.log(`Incident Service running on port ${PORT}`));
};

start();

module.exports = app;
