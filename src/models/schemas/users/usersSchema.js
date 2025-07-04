import { pgTable, serial, varchar, smallint, timestamp } from 'drizzle-orm/pg-core';
import { roleEnum, providerTypeEnum } from '@/models/enums/index.js';

const usersTable = pgTable("users", {
  id: serial().primaryKey(),
  username: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 100 }).unique(),

  role: roleEnum("role").default('user'),
  providerType: providerTypeEnum("provider_type").notNull(),
  status: smallint("status").default(1).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { usersTable };