import { roleEnum, providerTypeEnum } from './enums/index.js';
import { usersTable } from './schemas/users/usersSchema.js';
import { emailUsersTable } from './schemas/users/emailUsersSchema.js';
import { googleUsersTable } from './schemas/users/googleUsersSchema.js';
import { lineUsersTable } from './schemas/users/lineUsersSchema.js';
import { userProfilesTable } from './schemas/users/userProfilesSchema.js';

import './relationships.js';

export const enums = {
  providerTypeEnum,
  roleEnum
};

export const tables = {
  usersTable,
  emailUsersTable,
  googleUsersTable,
  lineUsersTable,
  userProfilesTable
};