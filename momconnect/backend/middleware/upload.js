const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const dirs = ['uploads/avatars', 'uploads/posts', 'uploads/groups', 'uploads/messages'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed!'), false);
  }
};

// Avatar storage
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/avatars/'),
  filename: (req, file, cb) => {
    cb(null, `avatar-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Post storage
const postStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/posts/'),
  filename: (req, file, cb) => {
    cb(null, `post-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
  }
});

// Group storage
const groupStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/groups/'),
  filename: (req, file, cb) => {
    cb(null, `group-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Message storage
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/messages/'),
  filename: (req, file, cb) => {
    cb(null, `msg-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
  }
});

// Message file filter (images + videos)
const messageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov|avi/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  const mimetype = allowedMimes.includes(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed!'), false);
  }
};

const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
const uploadPost = multer({ storage: postStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });
const uploadGroup = multer({ storage: groupStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
const uploadMessage = multer({ storage: messageStorage, limits: { fileSize: 25 * 1024 * 1024, files: 5 }, fileFilter: messageFileFilter });

module.exports = { uploadAvatar, uploadPost, uploadGroup, uploadMessage };