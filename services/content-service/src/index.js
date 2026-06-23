require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const contentRoutes = require('./routes/contentRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/content', contentRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'content-service' }));

// Error middleware MORA biti posle svih ruta (Express ga prepoznaje po tome da
// prima 4 argumenta - (err, req, res, next) - i poziva ga samo kad neka ruta
// pozove next(err) ili baci gresku).
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Content Service running on port ${config.port}`);
});
