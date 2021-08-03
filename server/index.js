const keys = require('./keys');

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.urlencoded({extended: true}));
app.use(express.json())

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.host,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});

pgClient.on('error', () => console.log('lost pg connection'));

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch((err) => console.error(err));
});

// Redis client setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

// handlers
app.get('/', (req, response) => {
  response.send('hi');
});

app.get('/values/all', async(req, res) => {
  const value = await pgClient.query('SELECT * from values');

  res.send(value.rows);
})

app.get('/values/current', async(req ,res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  })
});

app.post('/values',  async(req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40 ) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [ index ]);

  res.send({ working: true});
});

app.listen(5000, () => console.log('listening'));
