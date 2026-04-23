// migrate_open_topic.js
const mongoose = require('mongoose');
require('dotenv').config();

const DB_URL = process.env.MONGODB_URL || `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME || 'ruihua_cms'}`;

async function runMigration() {
    try {
        console.log(`Connecting to MongoDB at: ${DB_URL}`);
        await mongoose.connect(DB_URL);
        console.log('Connected successfully.');

        const db = mongoose.connection.db;
        const collection = db.collection('surveysubmissions');

        // Add open_topic: null to all records where it doesn't exist
        const result = await collection.updateMany(
            { open_topic: { $exists: false } },
            { $set: { open_topic: null } }
        );

        console.log(`Migration completed successfully.`);
        console.log(`Matched documents: ${result.matchedCount}`);
        console.log(`Modified documents: ${result.modifiedCount}`);
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    }
}

runMigration();
