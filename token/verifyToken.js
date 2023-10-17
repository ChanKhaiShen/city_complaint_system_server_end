const jwt = require('jsonwebtoken');

const JWT_SECRET = '9d8fjek0zlsdni4232dnxi90138dcx';
const verifyToken = (req, res, next) => {
    var token = req.headers['authorization'];
    console.log('verifyToken', token);
    token = token.split(' ')[1];
    console.log('verifyToken', token);

    if (token === undefined) {
        console.log('verifyToken: No token')
        res.status(401).json({
            message: "No token provided"
        });
        return;
    }

    jwt.verify(token, JWT_SECRET, (error, decoded) => {
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
