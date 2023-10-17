const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    emailAddress: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now,
        expires: 60 * 5     // expires in 5 minutes
    }
});

const otpModel = mongoose.model('otps', otpSchema);

module.exports = otpModel;
