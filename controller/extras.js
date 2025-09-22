const pool = require('../modules/db');

class ExtraClass { 
    
    async getAllExtras(client) {
        const res = await client.query('SELECT * FROM extras');
        return res.rows;
    }
    async createExtra(extraName, extraPrice, client) {
        const res = await client.query(
            'INSERT INTO extras (extra_name, extra_price, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
            [extraName, extraPrice]
        );
        return res.rows[0];
    }
    async deleteExtra(extraId, client) {
        const res = await client.query(
            'DELETE FROM extras WHERE extra_id = $1 RETURNING *',       
            [extraId]
        );
        return res.rows[0];
    }
}
module.exports = ExtraClass;
