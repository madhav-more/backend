import jwt from 'jsonwebtoken';

/**
 * Flexible authentication middleware
 * Supports both JWT tokens and simple user ID header
 */
export const flexibleAuth = (req, res, next) => {
  try {
    // Try JWT auth first
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = { userId: decoded.userId };
        return next();
      } catch (jwtError) {
        // JWT failed, try simple auth
        console.log('JWT verification failed, trying simple auth');
      }
    }
    
    // Try simple user ID header
    const userId = req.headers['x-user-id'];
    
    if (userId) {
      // For simple auth, use the user ID directly
      req.user = { userId };
      return next();
    }
    
    // No valid authentication found
    return res.status(401).json({ error: 'Authentication required' });
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Optional authentication - doesn't fail if not authenticated
 * Useful for public endpoints that work better with auth
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = { userId: decoded.userId };
      } catch (jwtError) {
        // Ignore JWT errors for optional auth
      }
    }
    
    // Try simple user ID header
    const userId = req.headers['x-user-id'];
    if (userId && !req.user) {
      req.user = { userId };
    }
    
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

export default flexibleAuth;
