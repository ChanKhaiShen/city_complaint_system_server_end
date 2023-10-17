const mongoose = require('mongoose');

const complainantSchema = new mongoose.Schema({
    emailAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxLength: 70,
        validate: {
            validator: emailAddress=>{
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
            }
        }
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    IC_Number: {
        type: String,
        required: true,
        trim: true,
        maxLength: 20
    },
    mobilePhoneNumber: {
        type: String,
        required: true,
        trim: true,
        maxLength: 20,
        validate: {
            validator: mobilePhoneNumber=>{
                /^[+]?[0-9]+[-]?[0-9]+[\s]?[0-9]+$/.test(mobilePhoneNumber);
            }
        }
    },
    homeAddress: {
        type: String,
        trim: true,
        maxLength: 100
    },
    faxNumber: {
        type: String,
        trim: true,
        maxLength: 20
    },
    created: {
        type: Date,
        default: Date.now
    }
});

const complainantModel = mongoose.model('complainants', complainantSchema);

module.exports = complainantModel;
