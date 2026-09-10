/**
 * 数据库配置和连接
 */

const mongoose = require('mongoose');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ruihua_cms';

/**
 * 连接到 MongoDB
 */
async function connectDatabase() {
  console.log('Environment MONGODB_URL:', process.env.MONGODB_URL);
  console.log('Using MongoDB URL:', mongoUrl);

  try {
    await mongoose.connect(mongoUrl);
    console.log('MongoDB Connected to:', mongoUrl);
    return mongoose.connection;
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }
}

/**
 * 优雅关闭数据库连接
 */
async function disconnectDatabase() {
  try {
    await mongoose.connection.close();
    console.log('MongoDB Connection Closed');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  mongoUrl
};
