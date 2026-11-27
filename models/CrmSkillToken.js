const { Schema, model } = require('mongoose');
const schema = new Schema({
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    label: { type: String, required: true },
    digest: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null }
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = model('CrmSkillToken', schema);
