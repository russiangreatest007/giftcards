// =======================
// server.js - Netlify Backend
// =======================

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

// =======================
// Nodemailer Transporter (Gmail)
// =======================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,       // your Gmail
    pass: process.env.EMAIL_PASS        // Gmail App Password
  }
});

// =======================
// Orders Database (JSON) - auto-create if missing
// =======================
const ORDERS_FILE = './orders.json';
if(!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, '[]');
}

function saveOrder(order) {
  let orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// =======================
// Hoodpay Webhook Endpoint
// =======================
app.post('/hoodpay-webhook', async (req, res) => {
  const { transaction_id, amount, email, status, type } = req.body;

  if(status !== 'success') {
    return res.status(400).send('Payment not successful');
  }

  try {
    // Verify payment with Hoodpay API
    const response = await axios.get(`https://api.hoodpay.io/transaction/${transaction_id}`, {
      headers: { Authorization: `Bearer ${process.env.HOODPAY_SECRET_KEY}` }
    });

    if(response.data.status !== 'success') {
      return res.status(400).send('Payment verification failed');
    }

    // Generate gift card code
    const giftCardCode = `GC-${Math.random().toString(36).substring(2,10).toUpperCase()}`;

    // Save order
    const order = { transaction_id, amount, email, type, giftCardCode, timestamp: new Date() };
    saveOrder(order);

    // Send auto email to customer
    const mailOptions = {
      from: `"Netlify Gift Cards" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your $${amount} Gift Card is Ready`,
      html: `
        <h2>Thank you for your order! 💗</h2>
        <p><strong>Transaction Type:</strong> ${type}</p>
        <p><strong>Amount Purchased:</strong> $${amount}</p>
        <p><strong>Your Gift Card Code:</strong> <code>${giftCardCode}</code></p>
        <p>The code will be delivered instantly. If you wish to cancel, you can get a full refund within 5 minutes.</p>
        <p>Enjoy your gift card!<br>Netlify Support Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).send('Webhook processed');
  } catch(err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`Netlify backend running on port ${PORT}`);
});