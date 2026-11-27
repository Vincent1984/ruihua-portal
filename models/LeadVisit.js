const { Schema, model } = require('mongoose');
const event = new Schema({
    id: String, at: Date, type: String, path: String, title: String, label: String, duration: Number
}, { _id: false });
const schema = new Schema({
    _id: String, version: { type: Number, default: 0 }, events: [event],
    expiresAt: { type: Date, required: true }
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = model('LeadVisit', schema);
