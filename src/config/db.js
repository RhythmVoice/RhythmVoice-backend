import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { logger: true });

// 設定時區
async function setupDatabase() {
  try {
    const client = await pool.connect();
    await client.query("SET TIME ZONE 'Asia/Taipei';");
    client.release();
    console.log('資料庫已設定為 Asia/Taipei 時區');
    
    // 測試連線
    const res = await pool.query('SELECT NOW()');
    console.log('資料庫連線成功 現在時間是：', res.rows[0].now);
  } catch (err) {
    console.error('資料庫設定失敗:', err);
    process.exit(1);
  }
}

// 初始化資料庫
setupDatabase();
console.log('資料庫初始化完成');

export { db };