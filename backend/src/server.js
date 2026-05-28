import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import stellarRoutes from './routes/stellar.js';
import assetsRoutes from './routes/assets.js';
import { initWebSocket } from './services/websocket.js';
import eventsRoutes from './routes/events.js';
import securityRoutes from './routes/security.js';
import loadTestingRoutes from './routes/loadTesting.js';
import chaosRoutes from './routes/chaos.js';
import { eventMonitor } from './eventSourcing/index.js';
import { auditLogger } from './security/index.js';
import { getConfig } from './config/env.js';

dotenv.config();

const logger = {
  info: (event, data) => console.log(`[${event}]`, data),
};

const app = express();
const config = getConfig();
const PORT = config.port;

const ALLOWED_ORIGINS = config.security.corsOrigins;

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Initialize event sourcing
await eventMonitor.initialize();
await auditLogger.initialize();

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/stellar', stellarRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/load-testing', loadTestingRoutes);
app.use('/api/chaos', chaosRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', network: config.stellarNetwork });
});

const httpServer = createServer(app);
initWebSocket(httpServer);

httpServer.listen(PORT, () => {
  logger.info('server.started', { port: PORT, network: config.stellarNetwork });
});
