require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// 🧠 ROUTE IMPORTS
const searchRouter = require('./routes/search');
const scrapeRouter = require('./routes/scrape');  // 👈 must be here, not below app.listen

// 🧠 MIDDLEWARES
app.use(express.json());

// 🧠 ROUTES
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/test', (req, res) => res.send('✅ Express is working fine'));

app.use('/api/search', searchRouter);
app.use('/api/scrape', scrapeRouter);  // 👈 must come BEFORE app.listen

app.get('/', (req, res) => res.send('🚀 Job Aggregator Backend is running'));

// 🧠 SERVER START
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${port}`);
});

