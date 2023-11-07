const mongoose = require('mongoose');

const complaintHandlerSchema = new mongoose.Schema({
    emailAddress: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        maxLength: 70,
        lowercase: true,
        validate: {
            validator: emailAddress=>{
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
            }
        }
    },
    password: {
        type: String,
        trim: true
    },
    salt: {
        type: String,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    role: {
        type: String,
        required: true,
        maxLength: 20,
        enum: ['complaint handler', 'administrator'],
        default: 'complaint handler'
    },
    created: {
        type: Date,
        default: Date.now
    }
});

const complaintHandlerModel = mongoose.model('complainthandlers', complaintHandlerSchema);

module.exports = complaintHandlerModel;
