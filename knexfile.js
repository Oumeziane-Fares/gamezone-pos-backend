"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path")); // <-- Import the path module
dotenv_1.default.config();
const config = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: path_1.default.resolve(__dirname, 'src/db/gamezone.sqlite3') // Also make this absolute
        },
        useNullAsDefault: true,
        migrations: {
            // Use path.resolve to create an absolute path
            directory: path_1.default.resolve(__dirname, 'src/db/migrations')
        }
    },
    test: {
        client: 'sqlite3',
        connection: {
            filename: ':memory:'
        },
        useNullAsDefault: true,
        migrations: {
            directory: path_1.default.resolve(__dirname, 'src/db/migrations')
        }
    },
    // Staging and Production configs remain the same, but it's good practice
    // to update their migration paths as well for consistency.
    staging: {
        client: 'postgresql',
        connection: process.env.STAGING_DATABASE_URL,
        pool: { min: 2, max: 10 },
        migrations: {
            directory: path_1.default.resolve(__dirname, 'src/db/migrations'),
            tableName: 'knex_migrations'
        }
    },
    production: {
        client: 'postgresql',
        connection: process.env.PRODUCTION_DATABASE_URL,
        pool: { min: 2, max: 10 },
        migrations: {
            directory: path_1.default.resolve(__dirname, 'src/db/migrations'),
            tableName: 'knex_migrations'
        }
    }
};
exports.default = config;
