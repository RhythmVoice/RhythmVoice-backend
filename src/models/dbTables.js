import { roleEnum, providerTypeEnum } from '@/models/enums/index.js';
import { usersTable, emailUsersTable, googleUsersTable, lineUsersTable } from '@/models/schemas/users';

import './relationships.js';

export const enums = {
  providerTypeEnum,
  roleEnum
};

export const tables = {
  usersTable,
  emailUsersTable,
  googleUsersTable,
  lineUsersTable
};