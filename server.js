require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const Stripe = require('stripe');
const db = require('./database');

const app = express();
const port = 3000;

let stripe;
let stripeWebhookSecret;

// Fetch Stripe Keys on startup
db.get(`SELECT value FROM settings WHERE key = 'stripe_restricted_key'`, (err, row) => {
    if (row) {
        stripe = Stripe(row.value);
    }
});
db.get(`SELECT value FROM settings WHERE key = 'stripe_webhook_secret'`, (err, row) => {
    if (row) {
        stripeWebhookSecret = row.value;
    }
});

// Middleware
// Webhook needs raw body
app.use('/api/stripe/webhook', express.raw({type: 'application/json'}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'ebook_store_secret_123',
    resave: false,
    saveUninitialized: true
}));

// Upload Setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync('uploads')){
    fs.mkdirSync('uploads');
}

// Authentication Middlewares
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

const requireAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(401).json({ error: 'Admin access required' });
};

// Routes - Auth
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Error hashing password' });

        db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Error saving user' });
            }
            req.session.userId = this.lastID;
            res.json({ message: 'Registration successful' });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Error checking user' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) return res.status(500).json({ error: 'Error checking password' });
            if (result) {
                req.session.userId = user.id;
                req.session.plan = user.plan;
                res.json({ message: 'Login successful' });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => {
    db.get(`SELECT id, email, plan FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Error getting user' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

// Routes - Admin
app.get('/api/admin/check', requireAdmin, (req, res) => {
    res.json({ message: 'Admin access confirmed' });
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    db.get(`SELECT value FROM settings WHERE key = 'admin_password'`, (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Error checking admin password' });

        bcrypt.compare(password, row.value, (err, result) => {
            if (result) {
                req.session.isAdmin = true;
                res.json({ message: 'Admin login successful' });
            } else {
                res.status(401).json({ error: 'Invalid admin password' });
            }
        });
    });
});

app.post('/api/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    res.json({ message: 'Admin logged out' });
});

// Admin eBook CRUD
app.post('/api/admin/ebooks', requireAdmin, upload.single('image'), (req, res) => {
    const { title, description, plan } = req.body;
    const imagePath = req.file ? '/uploads/' + req.file.filename : null;

    db.run(`INSERT INTO ebooks (title, description, image, plan) VALUES (?, ?, ?, ?)`,
        [title, description, imagePath, plan || 'basic'], function(err) {
            if (err) return res.status(500).json({ error: 'Error adding ebook' });
            res.json({ message: 'eBook added successfully', id: this.lastID });
    });
});

app.put('/api/admin/ebooks/:id', requireAdmin, upload.single('image'), (req, res) => {
    const { title, description, plan } = req.body;
    const id = req.params.id;

    if (req.file) {
        const imagePath = '/uploads/' + req.file.filename;
        db.run(`UPDATE ebooks SET title = ?, description = ?, image = ?, plan = ? WHERE id = ?`,
            [title, description, imagePath, plan || 'basic', id], (err) => {
                if (err) return res.status(500).json({ error: 'Error updating ebook' });
                res.json({ message: 'eBook updated successfully' });
        });
    } else {
        db.run(`UPDATE ebooks SET title = ?, description = ?, plan = ? WHERE id = ?`,
            [title, description, plan || 'basic', id], (err) => {
                if (err) return res.status(500).json({ error: 'Error updating ebook' });
                res.json({ message: 'eBook updated successfully' });
        });
    }
});

app.delete('/api/admin/ebooks/:id', requireAdmin, (req, res) => {
    db.run(`DELETE FROM ebooks WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Error deleting ebook' });
        res.json({ message: 'eBook deleted successfully' });
    });
});

// Routes - Catalog
// Modified to allow admins to fetch ebooks without normal user auth
app.get('/api/ebooks', (req, res) => {
    if (!req.session.userId && !req.session.isAdmin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.all(`SELECT * FROM ebooks`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching ebooks' });
        res.json(rows);
    });
});

// Routes - Stripe Payment
app.get('/api/stripe/config', requireAuth, (req, res) => {
    db.get(`SELECT value FROM settings WHERE key = 'stripe_public_key'`, (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Stripe not configured' });
        res.json({ publishableKey: row.value });
    });
});

app.post('/api/stripe/create-payment-intent', requireAuth, async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1999, // e.g., $19.99 for Pro plan
            currency: 'brl', // fallback to brl since it's an account created in Brazil, and usually BRL has default payment methods like Card. Or we can just use payment_method_types: ['card']
            payment_method_types: ['card'],
            metadata: { userId: req.session.userId }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const userId = paymentIntent.metadata.userId;

        if (userId) {
            db.run(`UPDATE users SET plan = 'pro' WHERE id = ?`, [userId], (err) => {
                if (err) console.error('Error updating user plan:', err);
                else console.log(`User ${userId} upgraded to PRO`);
            });
        }
    }

    res.json({received: true});
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
