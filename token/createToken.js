const jwt = require('jsonwebtoken');

const JWT_SECRET = '9d8fjek0zlsdni4232dnxi90138dcx';

const createToken = payload => {
    return jwt.sign(
        payload,
        JWT_SECRET, 
        {
            expiresIn: '3h'
        }
    );
}

module.exports = createToken;
