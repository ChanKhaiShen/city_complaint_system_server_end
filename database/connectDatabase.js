const mongoose = require('mongoose');

require('dotenv').config();

const connectionString = `${process.env.DB_STRING}${process.env.DB_NAME}`;

const connectDatabase = () => {
    mongoose.connect(connectionString).then(()=>{
        console.log('Connected to database');
    }).catch(error=>{
        console.log('Not connected to database', error)
    });
}

module.exports = connectDatabase;
