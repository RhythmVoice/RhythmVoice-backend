import { roleEnum, providerTypeEnum } from '@/models/enums/index.js';
import { usersTable } from '@/models/schemas/usersSchema.js';
import { emailUsersTable } from '@/models/schemas/emailUsersSchema.js';
import { googleUsersTable } from '@/models/schemas/googleUsersSchema.js';
import { lineUsersTable } from '@/models/schemas/lineUsersSchema.js';

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
};