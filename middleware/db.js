const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.POSTGRESQL_HOST,
    user: process.env.POSTGRESQL_USER,
    database: process.env.POSTGRESQL_DATABASE,
    password: process.env.POSTGRESQL_PASSWORD,
    port: parseInt(process.env.POSTGRESQL_PORT, 10),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

// Test connection
(async () => {
    try {
        const client = await pool.connect();
        console.log('✅  DB connected successfully');
        client.release();
    } catch (err) {
        console.error('❌  DB connection failed:', err.message);
    }
})();

module.exports = pool;
