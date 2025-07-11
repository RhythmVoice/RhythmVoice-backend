import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOptions } from './src/config/cors.js';
import './src/config/db.js';

dotenv.config();

if (!process.env.COOKIE_SECRET || !process.env.JWT_SECRET) {
  console.error('Missing required environment variables');
  process.exit(1);
}

import apiRoutes from './src/routes/apiRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 基本中間件
app.use(cors(corsOptions));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 統一 API 路由
app.use('/api', apiRoutes);

// 根路徑
app.get('/', (req, res) => {
  res.json({
    success: true,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*'
    }
  });
});

app.listen(PORT, () => {
  console.log(`伺服器已啟動於 http://localhost:${PORT}`);
});