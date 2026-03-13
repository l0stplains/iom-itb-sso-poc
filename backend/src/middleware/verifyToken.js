const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const config = require('../config');

// Cache JWKS keys for 10 minutes to avoid hammering Keycloak on every request
const client = jwksClient({
  jwksUri: config.keycloakJwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', details: 'Missing Bearer token' });
  }

  const token = authHeader.slice(7);

  jwt.verify(
    token,
    getKey,
    {
      issuer: config.keycloakIssuer,
      audience: 'backend-api',
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        console.warn('[Auth] Token verification failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized', details: err.message });
      }
      req.user = decoded;
      next();
    }
  );
}

module.exports = verifyToken;
