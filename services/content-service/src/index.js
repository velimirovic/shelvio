require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// TODO: mount routes
// app.use('/api/content', require('./routes/content.routes'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'content-service' }));

app.listen(PORT, () => {
  console.log(`Content Service running on port ${PORT}`);
});
