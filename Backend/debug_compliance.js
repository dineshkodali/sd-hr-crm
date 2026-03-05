import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const HOTEL_JOIN = `
  LEFT JOIN hotels h
    ON (c.hotel_name IS NOT NULL AND h.name ILIKE c.hotel_name)
`;

async function testQuery() {
    try {
        console.log("Connecting to DB...");
        const client = await pool.connect();
        console.log("Connected.");
        client.release();

        const limit = 200;
        const offset = 0;

        const where = ["c.is_active IS TRUE"];
        const params = [limit, offset];

        const sql = `SELECT c.*,
      COALESCE(h.name, c.hotel_name) AS hotel_name,
      CASE
        WHEN c.expiry_date < current_date THEN 'expired'
        WHEN c.expiry_date <= (current_date + INTERVAL '30 days') THEN 'expiring'
        ELSE 'valid'
      END AS status
    FROM certificates c
    ${HOTEL_JOIN}
    WHERE ${where.join(" AND ")}
    ORDER BY c.expiry_date ASC
    LIMIT $1 OFFSET $2;`;

        console.log("Running Query:", sql);
        console.log("Params:", params);

        const res = await pool.query(sql, params);
        console.log("Query OK. Row count:", res.rowCount);
        console.log("First row:", res.rows[0]);

        // Also test stats query
        const statsSql = `SELECT
      COUNT(*) FILTER (WHERE expiry_date > (current_date + INTERVAL '30 days') AND is_active IS TRUE) AS valid_count,
      COUNT(*) FILTER (WHERE expiry_date <= (current_date + INTERVAL '30 days') AND expiry_date >= current_date AND is_active IS TRUE) AS expiring_count,
      COUNT(*) FILTER (WHERE expiry_date < current_date AND is_active IS TRUE) AS expired_count
    FROM certificates;`;

        const statsRes = await pool.query(statsSql);
        console.log("Stats:", statsRes.rows[0]);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

testQuery();
