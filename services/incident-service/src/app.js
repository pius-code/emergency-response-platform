const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
require('dotenv').config();

const incidentRoutes = require('./routes/incident.routes');
const { connectDB } = require('./config/db');
const { connectQueue } = require('./config/queue');

const app = express();
app.use(cors());
app.use(express.json());

// Swagger docs — available at /api-docs
const swaggerDoc = yaml.load(fs.readFileSync(`${__dirname}/swagger.yaml`, 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

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
