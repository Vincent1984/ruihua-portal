module.exports = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 27017,
    database: process.env.DB_NAME || 'ruihua_cms',
    url: process.env.MONGODB_URL || `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME || 'ruihua_cms'}`
  },
  production: {
    host: process.env.DB_HOST || 'mongodb',
    port: process.env.DB_PORT || 27017,
    database: process.env.DB_NAME || 'ruihua_cms',
    url: process.env.MONGODB_URL || `mongodb://${process.env.DB_HOST || 'mongodb'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME || 'ruihua_cms'}`
  }
};