const { Router } = require('express');
const verifyToken = require('../middleware/verifyToken');
const { syncUser } = require('../db/userSync');

const router = Router();

router.get('/me', verifyToken, async (req, res) => {
  try {
    const appData = await syncUser(req.user);

    res.json({
      // Data from the Keycloak JWT (source of truth for identity)
      keycloak: {
        sub: req.user.sub,
        email: req.user.email,
        name: req.user.name,
        preferred_username: req.user.preferred_username,
        given_name: req.user.given_name,
        family_name: req.user.family_name,
        roles: req.user.realm_access?.roles ?? [],
        email_verified: req.user.email_verified,
        iat: req.user.iat,
        exp: req.user.exp,
        iss: req.user.iss,
        aud: req.user.aud,
      },
      // Application-specific data stored in our own database
      appData: {
        id: appData.id,
        role: appData.role,
        notes: appData.notes,
        created_at: appData.created_at,
        last_seen_at: appData.last_seen_at,
      },
    });
  } catch (err) {
    console.error('[/api/me] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
