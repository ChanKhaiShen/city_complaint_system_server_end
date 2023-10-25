const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxLength: 50
    },
    creatorEmail: {
        type: String,
        trim: true
    },
    creatorName: {
        type: String,
        trim: true
    },
    created: {
        type: Date,
        default: Date.now
    }
});

const areaModel = mongoose.model("areas", areaSchema);

module.exports = areaModel;
