import { relations } from 'drizzle-orm';
import { usersTable } from '@/models/schemas/users/usersSchema.js';
import { emailUsersTable } from '@/models/schemas/users/emailUsersSchema.js';
import { googleUsersTable } from '@/models/schemas/users/googleUsersSchema.js';

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