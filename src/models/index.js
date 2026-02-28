/**
 * Model Abstraction Layer
 *
 * This is the SINGLE FILE that controls which database implementation
 * the entire application uses.
 *
 * To switch databases, change only the one import below:
 *   PostgreSQL  →  export * from './postgres/index.js'; 
 *   MongoDB     →  export * from './mongodb/index.js';
 *   SQLite      →  export * from './sqlite/index.js';
 *
 * Every service/middleware imports from THIS file, never from a specific
 * implementation or individual model file.
 *
 * Flow: Services → models/index.js → postgres/index.js → *.model.js (Knex)
 */

export * from './postgres/index.js';
