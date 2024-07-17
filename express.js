// server.js
const express = require('express');
const db = require('./bd.js');
const productRoutes = require('./routes/productsRoutes');

const app = express();
const port = 8080;

app.use(express.json());

app.get('/', (req, res) => {
  db.query('SELECT * FROM users;', (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }
    res.json(results);
  });
});

app.use('/api', productRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

