const express = require('express');
const PORT = 8080;
const bodyParser = require('body-parser')
const { Client } = require('pg');
const app = express()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
  next();
});

const db = new Client({
    host: process.env.HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    ssl: {
        rejectUnauthorized: false,
      }
})

db.connect();

app.listen(PORT);
console.log('it works 111');

// workshops
app.get('/workshops', async (req, res) => {
  try {
    const dbRes = await db.query(`SELECT * FROM workshop`);
    db.end;
    res.status(200).send(dbRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
})

// registrations
app.get('/summary', async (req, res) => {
  try {
    const dbRes = await db.query(`select w."name", wa.membername,  wa.memberid, wa.datetime  FROM public.workshopassingment wa
join public.workshop w on w.id = wa.workshopid 
where datetime >= now()::date`);
    db.end;
    const registrations = [];

    dbRes.rows.forEach(x => {
      registrations.push({
        name: x.name,
        membername: x.membername,
        memberid: x.memberid,
        datetime: x.datetime,
      });
    })

    const groupedRegistrations = Object.groupBy(registrations, ({ name }) => name);

    res.status(200).send(groupedRegistrations);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
})

app.post('/registrations', async (req, res) => {
  try {
    const reg = {
      workshopId: req.body.workshopId,
      memberId: req.body.memberId,
      memberName: req.body.memberName,
      deviceId: req.body.deviceId,
      datetime: new Date()
    }
    console.log(reg);
    const qr = `INSERT INTO public.workshopassingment
      (workshopid, memberid, membername, deviceid, datetime)
      VALUES( '${reg.workshopId}', '${reg.memberId}', '${reg.memberName}', '${reg.deviceId}', '${reg.datetime.toISOString()}');`
    const dbRes = await db.query(qr);
    db.end;
    console.log(dbRes);
    res.status(200).send(reg);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
})

