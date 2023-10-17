const mongoose = require('mongoose');

const connectionString = 'mongodb+srv://chankhaishen:C2pHmL6lON7CNXMB@cluster0.kqxxo56.mongodb.net/CityComplaintSystemDatabase';

const connectDatabase = () => {
    mongoose.connect(connectionString).then(()=>{
        console.log('Connected to database');
    }).catch(error=>{
        console.log('Not connected to database', error)
    });
}

module.exports = connectDatabase;
