const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const connectDB = require('./src/config/db');
const config = require('./src/config');
const socketHandler = require('./src/sockets');
const authRoutes = require('./src/routes/auth');
const roomRoutes = require('./src/routes/rooms');
const messageRoutes = require('./src/routes/messages');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

connectDB();

socketHandler(io);

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);

const gracefulShutdown = () => {
  io.close(() => {
    console.log('Socket.IO closed');
  });
  server.close(() => {
    console.log('Server closed');
    require('mongoose').connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});