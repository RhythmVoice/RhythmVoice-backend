import { pgEnum } from 'drizzle-orm/pg-core';

const statusEnum = pgEnum("status", ["1", "2"]);

export { statusEnum };