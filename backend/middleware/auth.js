const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // Get token from header
    let token = req.header('x-auth-token');

    // Check Authorization header for Bearer token if x-auth-token is not present
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Check if no token
    if (!token) {
        console.warn('--- [AUTH/401] --- No token found in headers (x-auth-token or Authorization)');
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.user || typeof decoded.user.id !== 'string' || typeof decoded.user.role !== 'string') {
            return res.status(401).json({ msg: 'Token is not valid' });
        }
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('--- [AUTH/ERROR] --- Validation failed:', err.message);
        // Possible reasons: "jwt malformed", "jwt expired", "invalid signature"
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
