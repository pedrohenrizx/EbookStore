require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        db.serialize(() => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                password TEXT,
                plan TEXT DEFAULT 'basic'
            )`);

            // eBooks table
            db.run(`CREATE TABLE IF NOT EXISTS ebooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                description TEXT,
                image TEXT,
                plan TEXT DEFAULT 'basic'
            )`);

            // Settings table (for admin password, stripe keys, webhook secret)
            db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);

            // Seed admin password
            bcrypt.hash('050708', 10, (err, hash) => {
                if (err) {
                    console.error('Error hashing password:', err);
                    return;
                }
                db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', ?)`, [hash], (err) => {
                    if (err) console.error('Error saving admin password:', err);
                    else console.log('Admin password seeded/checked.');
                });
            });

            // Seed Stripe Keys from Environment Variables
            const publicKey = process.env.STRIPE_PUBLIC_KEY || 'YOUR_STRIPE_PUBLIC_KEY';
            const restrictedKey = process.env.STRIPE_RESTRICTED_KEY || 'YOUR_STRIPE_RESTRICTED_KEY';
            const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'YOUR_STRIPE_WEBHOOK_SECRET';

            db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('stripe_public_key', ?)`, [publicKey]);
            db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('stripe_restricted_key', ?)`, [restrictedKey]);
            db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('stripe_webhook_secret', ?)`, [webhookSecret]);

            console.log('Database initialization tasks submitted.');
        });
    }
});

module.exports = db;
