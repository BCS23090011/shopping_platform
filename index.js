const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 测试数据库连接
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Database connection failed:', err);
  else console.log('Connected to database:', res.rows[0].now);
});

// 注册用户
app.post('/register', async (req, res) => {
  const { email, password, userName } = req.body;
  try {
    await pool.query(
      'INSERT INTO users (email, password_hash, user_name) VALUES ($1, $2, $3)',
      [email, password, userName]
    );
    res.json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 用户登录
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password_hash = $2',
      [email, password]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 获取商品列表
app.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// 添加商品到购物车
app.post('/cart', async (req, res) => {
  const { userId, productId, quantity } = req.body;
  try {
    await pool.query(
      'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)',
      [userId, productId, quantity]
    );
    res.json({ message: 'Product added to cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// 获取购物车内容
app.get('/cart/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.product_id, p.product_name, p.price, c.quantity
       FROM cart c
       JOIN products p ON c.product_id = p.product_id
       WHERE c.user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// 添加商品到收藏夹
app.post('/favourites', async (req, res) => {
  const { userId, productId } = req.body;
  try {
    await pool.query(
      'INSERT INTO favourites (user_id, product_id) VALUES ($1, $2)',
      [userId, productId]
    );
    res.json({ message: 'Product added to favourites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to favourites' });
  }
});

// 获取收藏夹
app.get('/favourites/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.product_id, p.product_name, p.price, p.image_url
       FROM favourites f
       JOIN products p ON f.product_id = p.product_id
       WHERE f.user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch favourites' });
  }
});

// 启动服务器
const PORT = process.env.PORT || 333;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
