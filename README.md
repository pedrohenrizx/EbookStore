# E-commerce eBook Store

This is a comprehensive e-commerce platform dedicated to selling eBooks. It is built using a mobile-first approach and modern web technologies.

## Features

- **User Authentication:** Registration and Login system using secure session-based authentication and `bcrypt` for password hashing. Users must be logged in to view the catalog and use the platform.
- **Role-Based Access:**
  - Standard users can access the catalog and their plan specifics.
  - Admin users can log in via a dedicated admin portal using a secure password.
- **Admin Dashboard:** Admins can Create, Read, Update, and Delete (CRUD) eBooks. eBooks include a title, description, an image, and a required plan level (Basic or Pro).
- **Subscription Plans:** Users start on the Basic Plan and can view basic tier books. They can upgrade to the Pro Plan.
- **Stripe Checkout Integration:** A custom checkout page powered by Stripe Elements allows users to upgrade to the Pro Plan securely. Once payment is confirmed via Stripe Webhooks, the user's plan is updated in the database.
- **Mobile-First Design:** Styled entirely with Tailwind CSS to ensure a fully responsive, clean, and modern user interface that works beautifully on mobile devices and scales up to desktop.
- **Database:** Uses SQLite to store users, eBooks, and application settings (such as Stripe API keys and the Admin password), ensuring sensitive keys are not exposed in the source code.

## Tech Stack

- **Frontend:** HTML5, Tailwind CSS (via CDN), Vanilla JavaScript.
- **Backend:** Node.js, Express.js.
- **Database:** SQLite3.
- **Authentication & Security:** express-session, bcrypt.
- **File Uploads:** multer (for eBook cover images).
- **Payments:** Stripe Node.js Library, Stripe Elements (Stripe.js).

## Installation and Setup

1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up Environment Variables:**
   Copy `.env.example` to `.env` and configure your Stripe keys and session secret.
   ```bash
   cp .env.example .env
   ```
4. **Initialize the Database:**
   This command creates the SQLite database, builds the required tables, and seeds the admin password and Stripe keys from your `.env` into the `settings` table securely.
   ```bash
   node database.js
   ```
5. **Start the Server:**
   ```bash
   node server.js
   ```
6. **Access the Application:**
   Open a browser and navigate to `http://localhost:3000`.

## Admin Access

To access the Admin panel, click the "Admin Panel" button in the navigation bar or go directly to `/admin-login.html`.
- **Admin Password:** `050708` (This password is automatically seeded into the database during initialization and is verified securely).

## Stripe Webhook Setup (for Local Testing)

If you are testing locally and want the webhook to process successful payments:
1. Install the Stripe CLI.
2. Run the Stripe CLI to forward events to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
3. Update the `stripe_webhook_secret` in your SQLite `settings` table with the webhook signing secret provided by the Stripe CLI.

*Note: The project comes pre-configured with a provided live webhook secret, which will work out-of-the-box if the application is deployed to the domain configured in your Stripe Dashboard.*
