import { pgTable, serial, integer, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { usersTable } from './usersTable';

const lineUsersTable = pgTable("line_users", {
  id: serial().primaryKey(),
	userId: integer('user_id').references(() => usersTable.id).unique().notNull(),
  lineUserId: varchar('line_user_id', { length: 255 }).unique().notNull(),
  lineDisplayName: varchar('line_display_name', { length: 255 }).notNull(),
  linePictureUrl: text('line_picture_url'),
  lineStatusMessage: text('line_status_message'),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { lineUsersTable };