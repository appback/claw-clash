const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://claw_clash:claw_clash@localhost:5437/claw_clash'
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
}
