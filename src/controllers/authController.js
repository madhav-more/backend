import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';

export const signup = async (req, res) => {
  const { name, email, password, company, location } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    // Check if user exists
    const [existingUsers] = await pool.query('SELECT _id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO users (_id, name, email, password_hash, company, location) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, email, password_hash, company, location]
    );

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        name,
        email,
        company,
        location,
        company_code: company?.substring(0, 3).toUpperCase() || 'GUR'
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        location: user.location,
        company_code: user.company?.substring(0, 3).toUpperCase() || 'GUR'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const validateToken = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE _id = ?', [req.user.userId]);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        location: user.location,
        company_code: user.company?.substring(0, 3).toUpperCase() || 'GUR'
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE _id = ?', [req.user.userId]);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        location: user.location,
        company_code: user.company?.substring(0, 3).toUpperCase() || 'GUR'
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

export const logout = async (req, res) => {
  const token = req.token;

  if (!token) {
    return res.status(400).json({ error: 'No token provided' });
  }

  try {
    // Decode token to get expiration
    const decoded = jwt.decode(token);
    const expiresAt = decoded ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days if decode fails

    await pool.query(
      'INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?)',
      [token, expiresAt]
    );

    console.log(`User ${req.user.userId} logged out`);
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};
