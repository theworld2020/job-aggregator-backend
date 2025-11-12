require('dotenv').config();
const express = require('express');
const cors = require('cors');  // ✅ Add this line
const app = express();
const port = process.env.PORT || 3000;

// ✅ Import routes
const searchRouter = require('./routes/search');
const scrapeRouter = require('./routes/scrape');

// ✅ Enable CORS for all origins
app.use(cors({
  origin: '*', // Allow all origins (for public use)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

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
