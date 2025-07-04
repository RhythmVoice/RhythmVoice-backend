import { pgEnum } from 'drizzle-orm/pg-core';

const providerTypeEnum = pgEnum("provider_type", ["email", "google", "line"]);

export { providerTypeEnum };