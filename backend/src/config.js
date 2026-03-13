require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://sso_app_user:sso_app_pass@localhost:5432/sso_app',
  keycloakJwksUri: process.env.KEYCLOAK_JWKS_URI || 'http://localhost:8080/realms/sso-poc/protocol/openid-connect/certs',
  keycloakIssuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/sso-poc',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002').split(','),
};
