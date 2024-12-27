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

app.post('/login-farmer', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM sellers WHERE email = $1 AND password_hash = $2',
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

app.delete('/cart/:userId', async (req, res) => {
  const { userId } = req.params; // Expects only userId in the request URL
  try {
    await pool.query('DELETE FROM cart WHERE user_id = $1', [userId]);
    res.json({ message: 'All items removed from cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});


// DELETE cart item by userId and productId
app.delete('/cart', async (req, res) => {
  const { userId, productId } = req.body;
  try {
    const result = await pool.query('DELETE FROM cart WHERE user_id = $1 AND product_id = $2', [userId, productId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});


app.delete('/favourites', async (req, res) => {
  const { userId, productId } = req.body;
  try {
    await pool.query('DELETE FROM favourites WHERE user_id = $1 AND product_id = $2', [userId, productId]);
    res.json({ message: 'Item removed from favourites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove item from favourites' });
  }
});

// Order Management Routes

app.post('/orders', async (req, res) => {
  const { userId, totalPrice, address } = req.body;

  if (!userId || !totalPrice || !address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if the address_id is already provided
    let addressId = address.address_id;

    // If not, fetch address_id from the database
    if (!addressId) {
      const addressResult = await pool.query(
        'SELECT address_id FROM addresses WHERE user_id = $1 AND address_line = $2 AND city = $3 AND postal_code = $4 AND country = $5 LIMIT 1',
        [userId, address.addressLine, address.city, address.postalCode, address.country]
      );

      if (addressResult.rows.length === 0) {
        return res.status(404).json({ error: 'Address not found' });
      }

      addressId = addressResult.rows[0].address_id;
    }

    // Insert order into the database
    const result = await pool.query(
      'INSERT INTO orders (user_id, total_price, address_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [userId, totalPrice, addressId]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.post('/order-details', async (req, res) => {
  const { orderId, productId, quantity, price } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO order_details (order_id, product_id, quantity, price, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [orderId, productId, quantity, price]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order detail' });
  }
});


app.post('/products', async (req, res) => {
  const { product_name, description, price, image_url, seller_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO products (product_name, description, price, image_url, seller_id) VALUES ($1, $2, $3, $4, $5)',
      [product_name, description, price, image_url, seller_id]
    );
    res.json({ message: 'Product uploaded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload product' });
  }
});

app.post('/register-farmer', async (req, res) => {
  const { email, password, storeName, contactNumber } = req.body;
  try {
    await pool.query(
      'INSERT INTO sellers (email, password_hash, store_name, contact_number) VALUES ($1, $2, $3, $4)',
      [email, password,storeName, contactNumber]
    );
    res.json({ message: 'Farmer registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Farmer registration failed' });
  }
});

// Add this in your backend code (index.js or server.js)
app.post('/address', async (req, res) => {
  const { userId, addressLine, city, postalCode, country, isDefault } = req.body;

  if (!userId || !addressLine || !city || !postalCode || !country) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO addresses (user_id, address_line, city, postal_code, country, is_default, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
      [userId, addressLine, city, postalCode, country, isDefault || false]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save address' });
  }
});

app.get('/address/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    // Query to get the default address first
    const defaultAddressResult = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 AND is_default = true LIMIT 1',
      [userId]
    );

    if (defaultAddressResult.rows.length > 0) {
      // Return the default address if it exists
      return res.status(200).json(defaultAddressResult.rows[0]);
    }

    // If no default address, fetch any address for the user
    const anyAddressResult = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    if (anyAddressResult.rows.length > 0) {
      return res.status(200).json(anyAddressResult.rows[0]);
    } else {
      // No address found
      return res.status(404).json({ error: 'No address found for this user' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch address' });
  }
});



// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
