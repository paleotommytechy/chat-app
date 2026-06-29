require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-key',
  corsOrigin: process.env.CLIENT_URL || '*'
};