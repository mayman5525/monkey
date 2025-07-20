const express = require('express');
const pool = require('./modules/db');
const { getAllUsers } = require('./models/user');
const { getAllProducts } = require('./models/product');
const { createForm } = require('./models/form');

const app = express();
app.use(express.json());

app.get('/users', async (req, res) => {
  const users = await getAllUsers();
  res.json(users);
});

app.get('/products', async (req, res) => {
  const products = await getAllProducts();
  res.json(products);
});

app.post('/forms', async (req, res) => {
  try {
    const form = await createForm(req.body);
    res.status(201).json(form);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating form');
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
