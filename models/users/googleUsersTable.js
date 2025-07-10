import { pgTable, serial, integer, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { usersTable } from './usersTable.js';

const googleUsersTable = pgTable("google_users", {
  id: serial().primaryKey(),
	userId: integer('user_id').references(() => usersTable.id).unique().notNull(),
  googleUserId: varchar('google_user_id', { length: 255 }).unique().notNull(),
  googleDisplayName: varchar('google_display_name', { length: 255 }).notNull(),
  googleEmail: varchar('google_email', { length: 255 }).notNull(),
  googlePictureUrl: text('google_picture_url'),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { googleUsersTable };