const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const { connectDB } = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

// Swagger docs — available at /api-docs
const swaggerDoc = yaml.load(fs.readFileSync(`${__dirname}/swagger.yaml`, 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Routes
app.use('/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
  });
});

module.exports = app;
