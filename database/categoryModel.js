const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50,
        unique: true,
    },
    isUsed: {
        type: Boolean,
        default: true
    },
    createdByEmail: {
        type: String,
        trim: true
    },
    createdByName: {
        type: String,
        trim: true
    },
    created: {
        type: Date,
        default: Date.now    
    }
});

const categoryModel = mongoose.model('categories', categorySchema);

module.exports = categoryModel;
