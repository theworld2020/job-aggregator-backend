require('dotenv').config();
const express = require('express');
const cors = require('cors');  // ✅ Must be here
const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS must be loaded BEFORE routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ✅ Import routes AFTER enabling CORS
const searchRouter = require('./routes/search');
const scrapeRouter = require('./routes/scrape');

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Test route
app.get('/api/test', (req, res) => res.send('✅ Express is working fine'));

// Routes
app.use('/api/search', searchRouter);
app.use('/api/scrape', scrapeRouter);

// Root
app.get('/', (req, res) => res.send('🚀 Job Aggregator Backend is running'));

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${port}`);
});
