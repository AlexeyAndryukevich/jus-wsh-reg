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
    ssl: false
})

db.connect();

app.listen(PORT);
console.log('it works 111');

// workshops
app.get('/workshops', async (req, res) => {
  try {
    const closeRegTime = new Date();
    closeRegTime.setHours(11);
    closeRegTime.setMinutes(30);

    const openRegTime = new Date();
    openRegTime.setHours(12);
    openRegTime.setMinutes(30);


    const now = new Date();

    if (now >= closeRegTime && now <= openRegTime) {
      res.status(404).send({message: 'Реєстрацію на сьогоднішні воркшопи закрито!'});
      return;
    }

    const workshopsList = await db.query(`SELECT * FROM workshop`);
    db.end;

    let occupieds = 0;
    if (now < closeRegTime) {
      occupieds = await db.query(`select workshopid, count(workshopid) FROM public.workshopassingment
        where datetime >= now()::date - interval '13 hour 30 minutes'
        group by workshopid`);
        db.end;

    } else {
      occupieds = await db.query(`select workshopid, count(workshopid) FROM public.workshopassingment
        where datetime >= now()::date + interval '9 hour 30 minutes'
        group by workshopid`);
            db.end;
    }

    const result = workshopsList.rows.map(x => { return {...x, occupied: occupieds.rows.find(y => y.workshopid === x.id)?.count }});
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
})

// registrations
app.get('/registrations/:id', async (req, res) => {
  try {
    const dbRes = await db.query(`select w."name", wa.membername, wa.memberid, wa.datetime FROM public.workshopassingment wa
join public.workshop w on w.id = wa.workshopid 
where wa.memberid = '${req.params.id}' order by wa.datetime`);
    db.end;
    res.status(200).send(dbRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
})

app.get('/summary', async (req, res) => {
  try {
    const openRegTime = new Date();
    openRegTime.setHours(12);
    openRegTime.setMinutes(30);

    const now = new Date();
    let dbRes;

    if (now < openRegTime) {
      dbRes = await db.query(`select w."name", h.lastname, h.firstname, wa.memberid, wa.datetime  FROM public.workshopassingment wa
        join public.workshop w on w.id = wa.workshopid 
        join public.hanihim h on h.id  = wa.memberid 
        where datetime >= now()::date - interval '13 hour 30 minutes'`);
        db.end;
    } else {
      dbRes = await db.query(`select w."name", h.lastname, h.firstname, wa.memberid, wa.datetime  FROM public.workshopassingment wa
        join public.workshop w on w.id = wa.workshopid 
        join public.hanihim h on h.id  = wa.memberid 
        where datetime >= now()::date + interval '9 hour 30 minutes'`);
            db.end;
    }

    const registrations = [];

    dbRes.rows.forEach(x => {
      registrations.push({
        name: x.name,
        membername: `${x.lastname} ${x.firstname}`,
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

// fix time collision
app.post('/registrations', async (req, res) => {
  try {
    const reg = {
      workshopId: req.body.workshopId,
      workshopName: req.body.workshopName,
      memberId: req.body.memberId,
      deviceId: req.body.deviceId,
      datetime: new Date()
    }
    console.log(reg);

    const openRegTime = new Date();
    openRegTime.setHours(12);
    openRegTime.setMinutes(30);

    const now = new Date();
    let occupied;

    if (now < openRegTime) {
      occupied = (await db.query(`select count(*) FROM public.workshopassingment
        where datetime >= now()::date - interval '13 hour 30 minutes' and workshopid = '${reg.workshopId}'`)).rows[0].count;
      db.end;
    } else {
      occupied = (await db.query(`select count(*) FROM public.workshopassingment
        where datetime >= now()::date + interval '9 hour 30 minutes' and workshopid = '${reg.workshopId}'`)).rows[0].count;
      db.end;
    }
    const capacity = (await db.query(`select capacity FROM public.workshop Where id = '${reg.workshopId}'`)).rows[0].capacity;
    db.end;

    console.log('occupied', occupied)
    console.log('capacity', capacity)
    console.log('occupied >= capacity', occupied >= capacity)
    if (occupied >= capacity) {
      res.status(400).send({message: `Всі місця на воркшоп "${reg.workshopName}" зайняті`});
      return;
    }
    let checkQuery;

    if (now < openRegTime) {
      checkQuery = `select w."name",  wa.memberid, wa.datetime  FROM public.workshopassingment wa
        join public.workshop w on w.id = wa.workshopid 
        where datetime >= now()::date - interval '13 hour 30 minutes' and wa.memberid = '${reg.memberId}'`;
    } else {
      checkQuery = `select w."name",  wa.memberid, wa.datetime  FROM public.workshopassingment wa
        join public.workshop w on w.id = wa.workshopid 
        where datetime >= now()::date + interval '9 hour 30 minutes' and wa.memberid = '${reg.memberId}'`;
    }
console.log(checkQuery);
    const dbCheckRes = await db.query(checkQuery);
    db.end;
    if (dbCheckRes.rowCount > 0) {
      res.status(409).send({message: `${dbCheckRes.rows[0].memberid} вже зареєстрован(-на) на сьогодні на воркшоп "${dbCheckRes.rows[0].name}"`});
      return;
    }

    const checkPeriod = `select w."name",   wa.memberid, wa.datetime  FROM public.workshopassingment wa
      join public.workshop w on w.id = wa.workshopid 
      where wa.memberid = '${reg.memberId}' and wa.workshopid = '${reg.workshopId}'`;
    console.log(checkPeriod);
    const dbcheckPeriodRes = await db.query(checkPeriod);
    db.end;
    if (dbcheckPeriodRes.rowCount > 0) {
      res.status(409).send({message: `Ви вже реєструвались на цей воркшоп за цю зміну`});
      return;
    }

    const insertQuery = `INSERT INTO public.workshopassingment
      (workshopid, memberid, deviceid, datetime)
      VALUES( '${reg.workshopId}', '${reg.memberId}', '${reg.deviceId}', '${reg.datetime.toISOString()}');`
    const dbRes = await db.query(insertQuery);
    db.end;
    console.log(dbRes);
    res.status(200).send({message: `Вітаємо, ${reg.memberId}! Ви успішно зареєстровані на воркшоп "${reg.workshopName}"`});
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
})

