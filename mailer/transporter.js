const nodemailer = require('nodemailer');

require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.MAILER_HOST,
    auth: {
        user: process.env.MAILER_USER,       // This supposed to be the city council's email, e.g. noreply@citycouncil.com
        pass: process.env.MAILER_PASS
    }
});

module.exports = transporter;
