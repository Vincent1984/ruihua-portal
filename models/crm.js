const { Schema, model } = require('mongoose');
const ref = Schema.Types.ObjectId;
const ownerId = { type: ref, default: null };
const archive = { type: Date, default: null };
const QUALIFICATIONS = ['lead', 'mql', 'sql'];
const qualificationEvent = new Schema({
    from: String, to: { type: String, enum: QUALIFICATIONS }, reason: String,
    nextStep: String, at: Date, actorId: ref, actor: String
}, { _id: false });

function entity(name, fields) {
    const schema = new Schema(fields, { timestamps: true, optimisticConcurrency: true });
    schema.index({ archivedAt: 1, ownerId: 1, updatedAt: -1 });
    return model(name, schema);
}
const Company = entity('CrmCompany', {
    name: { type: String, required: true }, nameKey: { type: String, unique: true, sparse: true },
    alias: String, industry: String, region: String, website: String, notes: String,
    ownerId, archivedAt: archive, mergedInto: ref
});
const Contact = entity('CrmContact', {
    name: { type: String, required: true }, phone: String, email: String,
    phoneKey: { type: String, unique: true, sparse: true }, emailKey: { type: String, unique: true, sparse: true },
    position: String, department: String, companyId: ref, tags: [String], notes: String,
    ownerId, archivedAt: archive, mergedInto: ref
});
const Lead = entity('CrmLead', {
    name: { type: String, required: true }, phone: String, email: String, companyName: String, companyAlias: String,
    source: { type: String, required: true }, receivedAt: Date, reportGroup: String, summary: String, tags: [String], contactId: { type: ref, index: true },
    companyId: { type: ref, index: true }, ownerId, archivedAt: archive, nextAt: Date,
    stage: { type: String, default: 'new' }, nextStep: String, closeReason: String,
    qualification: { type: String, enum: QUALIFICATIONS, default: 'lead' },
    qualificationHistory: [qualificationEvent],
    opportunityId: ref, matchIssue: String, dedupKey: { type: String, unique: true, sparse: true }
});
const Opportunity = entity('CrmOpportunity', {
    name: { type: String, required: true }, direction: String, summary: String, tags: [String],
    contactId: { type: ref, index: true }, companyId: { type: ref, index: true },
    leadId: { type: ref, unique: true, sparse: true }, ownerId, archivedAt: archive,
    stage: { type: String, default: 'demand' }, expectedAmount: Number, expectedAt: Date,
    actualAmount: Number, wonAt: Date, lossReason: String, nextAt: Date, nextStep: String
});
const Event = model('CrmEvent', new Schema({
    _id: String, source: String, sourceId: String,
    leadId: { type: ref, index: true }, contactId: { type: ref, index: true },
    at: Date, title: String, sourcePage: String
}, { timestamps: true }));
const Activity = model('CrmActivity', new Schema({
    entity: String, entityId: { type: ref, index: true }, kind: String,
    summary: String, nextStep: String, nextAt: Date, actorId: ref, actor: String
}, { timestamps: true }));
const Sync = model('CrmSync', new Schema({
    _id: String, leaseUntil: Date, leaseToken: String, completedAt: Date, errorAt: Date
}));
module.exports = { QUALIFICATIONS, Company, Contact, Lead, Opportunity, Event, Activity, Sync };
