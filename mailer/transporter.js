const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    auth: {
        user: 'chankhaishen36@gmail.com',       // This supposed to be the city council's email, e.g. noreply@citycouncil.com
        pass: 'etpfihhiguxyzqlc'
    }
});

module.exports = transporter;
