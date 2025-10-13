// src/db/knex.ts
import knex from 'knex';
import config from '../../knexfile'; // Use the default export

const db = knex(config.development);

export default db;