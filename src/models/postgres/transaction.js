import db from '../../utils/db.js';

export const transaction = (...args) => db.transaction(...args);
