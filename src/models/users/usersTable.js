import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
import providerTypeEnum from '../enums/providerTypeEnum.js';
import roleEnum from '../enums/roleEnum.js';
import statusEnum from '../enums/statusEnum.js';


const usersTable = pgTable("users", {
  id: serial().primaryKey(),
  username: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 100 }).unique(),

  role: roleEnum("role").default('user'),
  providerType: providerTypeEnum("provider_type").notNull(),
  status: statusEnum("status").default(1).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { usersTable };