const jwt = require("jsonwebtoken");
const createError = require('http-errors');

const verifyAdmin = (req, res, next) => {
  try {
    // 1. Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw createError(401, 'Authorization header is required');
    }

    // 2. Verify Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      throw createError(401, 'Invalid authorization header format. Expected "Bearer <token>"');
    }

    // 3. Extract token
    const token = authHeader.split(" ")[1];
    if (!token) {
      throw createError(401, 'Authentication token not found');
    }

    // 4. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw createError(401, 'Token expired');
      }
      throw createError(401, 'Invalid token');
    }

    // 5. Verify admin role
    if (decoded.role !== "admin") {
      throw createError(403, 'Admin access required');
    }

    // 6. Attach user to request
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      // Add other necessary user data
    };

    // 7. Log successful verification (in production, use a proper logger)
    console.log(`Admin access granted to ${decoded.email}`);

    next();
  } catch (error) {
    // Log the error (in production, use a proper logger)
    console.error('Admin verification error:', error.message);

    // Send appropriate error response
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

module.exports = { verifyAdmin };