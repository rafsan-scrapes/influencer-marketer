// backend/src/index.js — Express app entry point
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import projectRoutes from './routes/projects.js';
import sequenceRoutes from './routes/sequences.js';
import templateRoutes from './routes/templates.js';
import contactRoutes from './routes/contacts.js';
import generatedRoutes from './routes/generated.js';
import aiRoutes from './routes/ai.js';
import generationRoutes from './routes/generation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/projects', projectRoutes);
app.use('/api', sequenceRoutes);
app.use('/api', templateRoutes);
app.use('/api', contactRoutes);
app.use('/api', generatedRoutes);
app.use('/api', aiRoutes);
app.use('/api', generationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: { code, message, details: err.details } });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`CORS enabled for: ${FRONTEND_URL}`);
});

export default app;