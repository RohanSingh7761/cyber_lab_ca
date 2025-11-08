const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../utils/hasuraClient');

const router = express.Router();

// Generate tokens
const generateAccessToken = (userId, email) => {
    return jwt.sign(
        { userId, email },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
    );
};

const generateRefreshToken = (userId, email) => {
    return jwt.sign(
        { userId, email },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
};

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if user exists
        const checkQuery = `
            query CheckUser($email: String!) {
                users(where: {email: {_eq: $email}}) {
                    id
                }
            }
        `;
        const checkResult = await executeQuery(checkQuery, { email });

        if (checkResult.users.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const insertQuery = `
            mutation InsertUser($email: String!, $password_hash: String!) {
                insert_users_one(object: {email: $email, password_hash: $password_hash}) {
                    id
                    email
                }
            }
        `;
        const result = await executeQuery(insertQuery, { email, password_hash: passwordHash });

        const user = result.insert_users_one;
        const accessToken = generateAccessToken(user.id, user.email);
        const refreshToken = generateRefreshToken(user.id, user.email);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({
            accessToken,
            user: { id: user.id, email: user.email }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Get user
        const query = `
            query GetUser($email: String!) {
                users(where: {email: {_eq: $email}}) {
                    id
                    email
                    password_hash
                }
            }
        `;
        const result = await executeQuery(query, { email });

        if (result.users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.users[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = generateAccessToken(user.id, user.email);
        const refreshToken = generateRefreshToken(user.id, user.email);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            accessToken,
            user: { id: user.id, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid refresh token' });
            }

            const accessToken = generateAccessToken(user.userId, user.email);
            res.json({ accessToken });
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
