const pool = require('./pool');

/**
 * Upsert a user record keyed by Keycloak's 'sub' claim.
 * Called on every authenticated request to /api/me.
 * Creates the row on first login, updates email/username/last_seen on subsequent visits.
 *
 * @param {object} jwtPayload - Decoded Keycloak JWT payload
 * @returns {object} The full user row from the database
 */
async function syncUser(jwtPayload) {
  const { sub, email, preferred_username, given_name, family_name, name } = jwtPayload;

  const displayName = name || [given_name, family_name].filter(Boolean).join(' ') || preferred_username;

  const result = await pool.query(
    `INSERT INTO users (keycloak_sub, email, username, last_seen_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (keycloak_sub) DO UPDATE
       SET email        = EXCLUDED.email,
           username     = EXCLUDED.username,
           last_seen_at = NOW()
     RETURNING *`,
    [sub, email || null, displayName || null]
  );

  return result.rows[0];
}

module.exports = { syncUser };
