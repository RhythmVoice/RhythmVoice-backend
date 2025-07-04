import { relations } from 'drizzle-orm';
import { usersTable } from '@/models/schemas/usersSchema.js';
import { emailUsersTable } from '@/models/schemas/emailUsersSchema.js';
import { googleUsersTable } from '@/models/schemas/googleUsersSchema.js';
import { lineUsersTable } from '@/models/schemas/lineUsersSchema.js';

// users 表關聯
export const usersSignUpRelations = relations(usersTable, ({ one }) => ({
  emailAuth: one(emailUsersTable, {
    fields: [emailUsersTable.userId],
    references: [usersTable.id],
  }),
  googleAuth: one(googleUsersTable, {
    fields: [googleUsersTable.userId],
    references: [usersTable.id],
  }),
  lineAuth: one(lineUsersTable, {
    fields: [lineUsersTable.userId],
    references: [usersTable.id],
  }),
}));

// emailUsers 表關聯
export const emailUsersRelations = relations(emailUsersTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [emailUsersTable.userId],
    references: [usersTable.id],
  }),
}));

// googleUsers 表關聯
export const googleUsersRelations = relations(googleUsersTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [googleUsersTable.userId],
    references: [usersTable.id],
  }),
}));

// lineUsers 表關聯
export const lineUsersRelations = relations(lineUsersTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [lineUsersTable.userId],
    references: [usersTable.id],
  }),
}));