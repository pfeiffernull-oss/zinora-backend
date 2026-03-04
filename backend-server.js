// Simple Backend Server for Launcher
// Install: npm install express cors bcrypt

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3551;

// Middleware
app.use(cors());
app.use(express.json());

// Simple file-based database
const DB_FILE = path.join(__dirname, 'users.json');

// Initialize database file
async function initDB() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify({ users: [] }, null, 2));
    console.log('✅ Database file created');
  }
}

// Read users from database
async function getUsers() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data).users;
  } catch (error) {
    console.error('Error reading database:', error);
    return [];
  }
}

// Write users to database
async function saveUsers(users) {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify({ users }, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// ========================================
// ROUTES
// ========================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Register new user
app.post('/api/launcher/register', async (req, res) => {
  try {
    const { email, username, password, discordId, avatarHash } = req.body;

    // Validation
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, username, and password are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Username validation
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 20 characters'
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    const users = await getUsers();

    // Check if email already exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // Check if username already exists
    if (users.find(u => u.username === username)) {
      return res.status(400).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      email,
      username,
      password: hashedPassword,
      discordId: discordId || null,
      avatarHash: avatarHash || null,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);

    console.log(`✅ New user registered: ${username} (${email})`);

    res.json({
      success: true,
      message: 'Account created successfully',
      username,
      discordId,
      avatarHash
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Login user
app.get('/api/launcher/login', async (req, res) => {
  try {
    const { email, password } = req.query;

    if (!email || !password) {
      return res.status(400).json('Email and password are required');
    }

    const users = await getUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(400).json('Error!');
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json('Error!');
    }

    console.log(`✅ User logged in: ${user.username}`);

    res.json({
      username: user.username,
      discordId: user.discordId,
      avatarHash: user.avatarHash
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json('Internal server error');
  }
});

// Get leaderboard (mock data)
app.get('/api/launcher/leaderboard', async (req, res) => {
  try {
    const users = await getUsers();
    
    // Mock leaderboard data
    const leaderboard = users
      .filter(u => u.discordId)
      .slice(0, 10)
      .map((u, index) => ({
        username: u.username,
        hype: Math.floor(Math.random() * 10000) + 1000,
        division: Math.floor(Math.random() * 10) + 1,
        discordId: u.discordId,
        avatarHash: u.avatarHash
      }))
      .sort((a, b) => b.hype - a.hype);

    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json([]);
  }
});

// Get shop (mock data)
app.get('/api/launcher/shop', async (req, res) => {
  try {
    // Mock shop data
    const shop = {
      featured: [
        {
          id: 'featured1',
          itemGrants: ['AthenaCharacter:CID_001_Athena_Commando_F_Default'],
          price: 1500
        },
        {
          id: 'featured2',
          itemGrants: ['AthenaCharacter:CID_002_Athena_Commando_F_Default'],
          price: 2000
        }
      ],
      daily: [
        {
          id: 'daily1',
          itemGrants: ['AthenaCharacter:CID_003_Athena_Commando_F_Default'],
          price: 800
        },
        {
          id: 'daily2',
          itemGrants: ['AthenaCharacter:CID_004_Athena_Commando_F_Default'],
          price: 1200
        }
      ]
    };

    res.json(shop);
  } catch (error) {
    console.error('Shop error:', error);
    res.status(500).json({ featured: [], daily: [] });
  }
});

// Get all users (admin only - for debugging)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await getUsers();
    // Remove passwords from response
    const safeUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      discordId: u.discordId,
      createdAt: u.createdAt
    }));
    res.json(safeUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// START SERVER
// ========================================

async function startServer() {
  await initDB();
  
  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  🚀 Backend Server Started');
    console.log('========================================');
    console.log(`  📡 Server running on: http://localhost:${PORT}`);
    console.log(`  🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`  📊 Admin panel: http://localhost:${PORT}/api/admin/users`);
    console.log('========================================');
    console.log('  Available endpoints:');
    console.log('  - POST /api/launcher/register');
    console.log('  - GET  /api/launcher/login');
    console.log('  - GET  /api/launcher/leaderboard');
    console.log('  - GET  /api/launcher/shop');
    console.log('========================================');
  });
}

startServer().catch(console.error);
