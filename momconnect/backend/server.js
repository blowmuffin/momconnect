const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
require('dotenv').config();

const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const chatbotRoutes = require('./routes/chatbot');

const app = express();
const server = http.createServer(app);

// Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to MongoDB
connectDB();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests'
});
app.use('/api/', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts, please try again later'
});
app.use('/api/auth', authLimiter);

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'MomConnect API is running' });
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.userId = user._id.toString();
    socket.userName = user.name;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// Socket.io connection
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, '- User:', socket.userName);

  // Auto-register authenticated user as online
  connectedUsers.set(socket.userId, socket.id);
  io.emit('userStatus', { userId: socket.userId, isOnline: true });

  socket.on('sendMessage', (data) => {
    const receiverSocket = connectedUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('receiveMessage', data);
    }
  });

  socket.on('typing', (data) => {
    const receiverSocket = connectedUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('userTyping', data);
    }
  });

  // Chatbot events
  socket.on('chatbotMessage', async (data) => {
    try {
      const { orchestrator } = require('./chatbot');
      const response = await orchestrator.processMessage(
        data.message,
        socket.userId,
        { latitude: data.latitude, longitude: data.longitude }
      );
      socket.emit('chatbotResponse', response);
    } catch (error) {
      console.error('Chatbot socket error:', error);
      socket.emit('chatbotResponse', {
        success: false,
        message: 'Sorry, I encountered an error. Please try again.',
        error: error.message
      });
    }
  });

  socket.on('chatbotTyping', (data) => {
    socket.emit('chatbotTypingAck', { received: true });
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.userId);
    io.emit('userStatus', { userId: socket.userId, isOnline: false });
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║     MomConnect Server Started          ║
  ╠════════════════════════════════════════╣
  ║  🚀 Port: ${PORT}                         ║
  ║  📍 Mode: ${process.env.NODE_ENV || 'development'}             ║
  ║  ❤️  Made for Moms                      ║
  ╚════════════════════════════════════════╝
  `);
});