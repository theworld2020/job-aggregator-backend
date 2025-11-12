require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000; // ✅ Render dynamically assigns this

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const searchRouter = require('./routes/search');
const scrapeRouter = require('./routes/scrape');

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/test', (req, res) => res.send('✅ Express is working fine'));

app.use('/api/search', searchRouter);
app.use('/api/scrape', scrapeRouter);

app.get('/', (req, res) => res.send('🚀 Job Aggregator Backend is running'));

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});

import jobsRouter from "./routes/jobs.js";
app.use("/api/jobs", jobsRouter);

import jobsRouter from "./routes/jobs.js";
app.use("/api/jobs", jobsRouter);
