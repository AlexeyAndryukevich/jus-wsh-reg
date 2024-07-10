const app = require('express')();
const PORT = 8080;

const { Client } = require('pg');
console.log('it works 111');

const db = new Client({
    host: process.env.HOST,
    user: process.env.DB_USER,
    port: process.env.PORT,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    ssl: {
        rejectUnauthorized: false,
      }
})

db.connect();

app.listen(PORT);

app.get('/registration', async (req, res) => {
    const dbRes = await getWorkshops();
    res.status(200).send(dbRes)
})

async function getWorkshops(data, table, condition) {
    try {
      const res = await db.query(`SELECT * FROM workshop`);
      db.end;
      return res.rows;
    } catch (err) {
      console.error(err.stack);
    }
}