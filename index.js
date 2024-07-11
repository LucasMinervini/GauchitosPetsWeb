const express = require('express');
const db = require('./server.js');  // Importa el archivo de conexión a la base de datos

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  db.query('SHOW TABLES; ', (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
