const jwt = require('jsonwebtoken');

require('dotenv').config();

const verifyToken = (req, res, next) => {
    var authorization = req.headers['authorization'];
    console.log('verifyToken', authorization);

    if (authorization === undefined) {
        console.log('verifyToken: Authorization header is empty')
        res.status(401).json({
            message: "Authorization header is empty"
        });
        return;
    }

    token = authorization.split(' ')[1];
    console.log('verifyToken', token);

    if (token === undefined) {
        console.log('verifyToken: No token')
        res.status(401).json({
            message: "No token provided"
        });
        return;
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error != null) {
            console.log('verifyToken: Fail to authenticate', error);
            res.status(401).json({
                message: "Fail to authenticate token"
            });
            return;
        }

        req.user = decoded;
        next();
    });
}

module.exports = verifyToken;
