const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 300 });
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT error:', error.message, '| server time:', Math.floor(Date.now() / 1000));
    return res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

module.exports = { verifyToken };
