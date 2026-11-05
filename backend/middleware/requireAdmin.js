// Apply after auth: a signed-in client must never receive studio-wide records.
module.exports = function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ msg: 'Authentication required' });
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Studio administrator access required' });
    return next();
};
