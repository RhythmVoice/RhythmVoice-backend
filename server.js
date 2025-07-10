import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOptions } from './src/config/cors.js';
import './src/config/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 基本中間件
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

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