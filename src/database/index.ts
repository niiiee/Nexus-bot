import { dbService } from './connection.js';

export const getDb = () => dbService.getRawDb();
export { dbService };
export * from './schema.js';
