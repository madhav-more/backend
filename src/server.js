import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB, { testConnection } from './config/mongodb.js';
import authRoutes from './routes/auth.js';
import itemsRoutes from './routes/items.js';
import customersRoutes from './routes/customers.js';
import transactionsRoutes from './routes/transactions.js';
import syncRoutes from './routes/sync.js';
import reportsRoutes from './routes/reports.js';
import vouchersRoutes from './routes/vouchers.js';
import chatbotRoutes from './routes/chatbot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
await connectDB();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/api/ping', async (req, res) => {
  const isHealthy = await testConnection();
  res.json({
    status: isHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    database: 'MongoDB Atlas'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/vouchers', vouchersRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 G.U.R.U POS Backend running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/ping`);
  console.log(`   Network: http://192.168.28.48:${PORT}/api/ping`);
  console.log(`   Database: MongoDB Atlas`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  process.exit(0);
});

export default app;
