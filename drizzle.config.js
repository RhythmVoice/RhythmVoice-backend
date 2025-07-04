import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: "./src/models/dbTables.js",
  out: "./src/drizzle/migrations",
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  },
  verbose: true,
  tablesFilter: ["!_*"],
});