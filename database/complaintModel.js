const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    complainantEmail: {
        type: String,
        required: true,
        trim: true
    },
    complainantName: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    category: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxLength: 500
    },
    expectedResult: {
        type: String,
        trim: true,
        maxLength: 200
    },
    area: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    incidentAddress: {
        type: String,
        trim: true,
        maxLength: 100
    },
    status: {
        type: String,
        required: true,
        enum: ['Received', 'Progressing', 'Solved'],
        default: 'Received'
    },
    complaintHandlerEmail: {
        type: String,
        trim: true
    },
    complaintHandlerName: {
        type: String,
        trim: true
    },
    histories: [
        {
            message: {
                type: String,
                required: true,
                trim: true,
                maxlength: 200
            },
            from: {
                type: String,
                required: true,
                enum: ['Complaint Handling Side', 'Complainant Side', 'System']
            },
            isInternal: {
                type: Boolean,
                default: false
            },
            created: {
                type: Date,
                default: Date.now
            }
        }
    ],
    created: {
        type: Date,
        default: Date.now
    }
});

const complainantModel = mongoose.model('complaints', complaintSchema);

module.exports = complainantModel;
