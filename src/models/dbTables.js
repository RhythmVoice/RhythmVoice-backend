import { roleEnum, providerTypeEnum } from '@/models/enums/index.js';
import { usersTable } from '@/models/schemas/users/usersSchema.js';
import { emailUsersTable } from '@/models/schemas/users/emailUsersSchema.js';
import { googleUsersTable } from '@/models/schemas/users/googleUsersSchema.js';
import { lineUsersTable } from '@/models/schemas/users/lineUsersSchema.js';
import { userProfilesTable } from '@/models/schemas/users/userProfilesSchema.js';

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