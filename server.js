const express = require('express');
const { Client } = require('pg');

const app = express();
const PORT = 3000;

const PG_CONFIG = {
    user: 'your_username',
    host: 'localhost',
    database: 'testdb',
    password: 'your_password',
    port: 5432,
};

const client = new Client(PG_CONFIG);

client.connect()
    .then(() => {
        console.log('Connected to PostgreSQL');
    })
    .catch((err) => {
        console.error('PostgreSQL connection error:', err);
    });

app.get('/', (req, res) => {
    res.send('App and database connectivity test successful!');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});