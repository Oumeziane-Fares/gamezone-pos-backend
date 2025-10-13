import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path'; // <-- Import the path module

dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve(__dirname, 'src/db/gamezone.sqlite3') // Also make this absolute
    },
    useNullAsDefault: true,
    migrations: {
      // Use path.resolve to create an absolute path
      directory: path.resolve(__dirname, 'src/db/migrations')
    }
  },

  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:'
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations')
    }
  },

  // Staging and Production configs remain the same, but it's good practice
  // to update their migration paths as well for consistency.
  staging: {
    client: 'postgresql',
    connection: process.env.STAGING_DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations'),
      tableName: 'knex_migrations'
    }
  },

  production: {
    client: 'postgresql',
    connection: process.env.PRODUCTION_DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations'),
      tableName: 'knex_migrations'
    }
  }
};

export default config;