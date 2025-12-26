const mongoose = require('mongoose');

// Schemas (simplified to strict: false to capture all fields)
const GenericSchema = new mongoose.Schema({}, { strict: false });

async function migrate() {
    console.log('🚀 Starting Migration...');
    
    // 1. Connect to Source (ruihua_cms)
    const sourceConn = mongoose.createConnection('mongodb://127.0.0.1:27017/ruihua_cms');
    await sourceConn.asPromise();
    console.log('✅ Connected to Source: ruihua_cms');

    // 2. Connect to Target (ruihua)
    const targetConn = mongoose.createConnection('mongodb://127.0.0.1:27017/ruihua');
    await targetConn.asPromise();
    console.log('✅ Connected to Target: ruihua');

    try {
        // --- FAQ Migration ---
        const SourceFaq = sourceConn.model('Faq', GenericSchema);
        const TargetFaq = targetConn.model('Faq', GenericSchema);

        const faqs = await SourceFaq.find();
        console.log(`\n📋 Found ${faqs.length} FAQs in Source.`);

        let faqCount = 0;
        for (const faq of faqs) {
            // Convert to object and delete _id to avoid collision if needed, 
            // OR keep _id to preserve identity. 
            // Keeping _id is better for restoration consistency.
            const faqObj = faq.toObject();
            
            // Check if exists
            const exists = await TargetFaq.findById(faqObj._id);
            if (!exists) {
                await TargetFaq.create(faqObj);
                faqCount++;
            } else {
                // Optional: Update if exists? For restore, maybe yes.
                await TargetFaq.findByIdAndUpdate(faqObj._id, faqObj);
                console.log(`  - Updated FAQ: ${faqObj._id}`);
            }
        }
        console.log(`✅ Restored ${faqCount} new FAQs.`);

        // --- Article Migration ---
        const SourceArticle = sourceConn.model('Article', GenericSchema);
        const TargetArticle = targetConn.model('Article', GenericSchema);

        const articles = await SourceArticle.find();
        console.log(`\n📋 Found ${articles.length} Articles in Source.`);

        let artCount = 0;
        for (const art of articles) {
            const artObj = art.toObject();
            
            const exists = await TargetArticle.findById(artObj._id);
            if (!exists) {
                await TargetArticle.create(artObj);
                artCount++;
            } else {
                await TargetArticle.findByIdAndUpdate(artObj._id, artObj);
                console.log(`  - Updated Article: ${artObj._id}`);
            }
        }
        console.log(`✅ Restored ${artCount} new Articles.`);

        // --- Category Migration ---
        const SourceCategory = sourceConn.model('Category', GenericSchema);
        const TargetCategory = targetConn.model('Category', GenericSchema);

        const categories = await SourceCategory.find();
        console.log(`\n📋 Found ${categories.length} Categories in Source.`);

        let catCount = 0;
        for (const cat of categories) {
            const catObj = cat.toObject();
            const exists = await TargetCategory.findById(catObj._id);
            if (!exists) {
                await TargetCategory.create(catObj);
                catCount++;
            } else {
                await TargetCategory.findByIdAndUpdate(catObj._id, catObj);
                console.log(`  - Updated Category: ${catObj._id}`);
            }
        }
        console.log(`✅ Restored ${catCount} new Categories.`);

    } catch (e) {
        console.error('❌ Migration Error:', e);
    } finally {
        await sourceConn.close();
        await targetConn.close();
        console.log('\n🏁 Migration Completed.');
    }
}

migrate();
