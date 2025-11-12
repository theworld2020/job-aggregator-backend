require('dotenv').config();
const express = require('express');
const cors = require('cors'); // ✅ Import CORS
const app = express();
const port = process.env.PORT || 3000;

// ✅ Enable CORS before defining any routes
app.use(cors({
  origin: '*', // Allow all origins for now
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ✅ Import routes
const searchRouter = require('./routes/search');
const scrapeRouter = require('./routes/scrape');

// ✅ Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ✅ Test Route
app.get('/api/test', (req, res) => res.send('✅ Express is working fine'));

// ✅ Main Routes
app.use('/api/search', searchRouter);
app.use('/api/scrape', scrapeRouter);

// ✅ Root message
app.get('/', (req, res) => res.send('🚀 Job Aggregator Backend is running'));

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${port}`);
});
