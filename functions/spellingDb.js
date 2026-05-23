const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.NEON_URL);

module.exports = sql;
