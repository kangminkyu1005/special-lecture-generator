import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const notices = sqliteTable('shared_notices', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull(),
  updatedAt: text('updated_at').notNull(),
});
