const jwt = require('jsonwebtoken');

require('dotenv').config();

const createToken = payload => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET, 
        {
            expiresIn: '3h'
        }
    );
}

module.exports = createToken;
