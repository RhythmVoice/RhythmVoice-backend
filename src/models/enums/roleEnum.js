import { pgEnum } from 'drizzle-orm/pg-core';

const roleEnum = pgEnum("role", ["admin", "user"]);

export { roleEnum };