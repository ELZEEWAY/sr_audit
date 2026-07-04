// server/server.js
// Simple Express API for remote sync (push/pull)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const auth = require('./middleware/auth');
const syncRouter = require('./routes/sync');

const app = express();
const PORT = process.env.SYNC_SERVER_PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // allow large payloads (images/PDFs)

// Apply auth middleware to all sync routes
app.use('/api/sync', auth, syncRouter);

app.get('/', (req, res) => {
  res.send('Sync server is running');
});

app.listen(PORT, () => {
  console.log(`🔄 Sync server listening on http://localhost:${PORT}`);
});
