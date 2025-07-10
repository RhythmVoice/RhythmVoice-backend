import { pgTable, serial, integer, varchar, text, date, timestamp } from 'drizzle-orm/pg-core';
import { usersTable } from './usersTable.js'; 

const userProfilesTable = pgTable("user_profiles", {
  id: serial().primaryKey(),
  userId: integer('user_id').references(() => usersTable.id).unique().notNull(),
	nickname: varchar('nickname', { length: 100 }),
  avatar: text('avatar'),
  birthday: date('birthday'),
  phone: varchar('phone', { length: 20 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { userProfilesTable };