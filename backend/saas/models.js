const mongoose = require('mongoose');
const { Schema } = mongoose;
// The account directory is global; operational models live in separate studio databases.
const globalModel = (name, schema) => mongoose.connection.models[name] || mongoose.connection.model(name, schema);
const account = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  firstName: { type: String, required: true }, lastName: { type: String, default: '' },
  passwordHash: { type: String, required: true, select: false },
  // Stable provider subjects identify social accounts; email is never an account-linking credential.
  oauthProvider: { type: String, enum: ['google', 'apple'], immutable: true },
  oauthSubject: { type: String, maxlength: 255, immutable: true },
  socialProvisioningToken: { type: String, select: false }, socialProvisioningUntil: Date,
  state: { type: String, enum: ['active', 'disabled'], default: 'active' },
}, { timestamps: true });
account.index({ oauthProvider: 1, oauthSubject: 1 }, { unique: true, partialFilterExpression: { oauthProvider: { $exists: true }, oauthSubject: { $exists: true } } });
const workspace = new Schema({
  name: { type: String, required: true }, slug: { type: String, required: true, unique: true },
  databaseName: { type: String, required: true, unique: true, immutable: true },
  ownerAccountId: { type: Schema.Types.ObjectId, required: true, ref: 'SaaSAccount' },
  state: { type: String, enum: ['provisioning', 'active', 'suspended', 'failed'], default: 'provisioning' },
  planId: { type: String, enum: ['starter', 'studio', 'scale'], default: 'starter' },
  subscriptionStatus: { type: String, enum: ['trialing', 'pending', 'active', 'past_due', 'cancelled', 'expired'], default: 'trialing' },
  trialEndsAt: { type: Date, required: true }, seatLimit: { type: Number, default: 5 },
  seatsReserved: { type: Number, default: 1, min: 0 },
  razorpaySubscriptionId: String, razorpayPlanId: String,
  pendingSubscriptionId: String, pendingPlanId: String, billingEventAt: { type: Number, default: 0 },
  checkoutState: { type: String, enum: ['creating', 'pending', 'reconcile'] }, checkoutRequestedAt: Date,
  billingSyncToken: String, billingSyncUntil: Date,
}, { timestamps: true });
const membership = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, required: true, ref: 'SaaSWorkspace' },
  accountId: { type: Schema.Types.ObjectId, required: true, ref: 'SaaSAccount' },
  localUserId: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['owner', 'admin', 'staff'], required: true },
  state: { type: String, enum: ['active', 'removed'], default: 'active' },
}, { timestamps: true });
membership.index({ workspaceId: 1, accountId: 1 }, { unique: true });
const invitation = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, required: true, ref: 'SaaSWorkspace' },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['admin', 'staff'], required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  state: { type: String, enum: ['pending', 'accepting', 'accepted', 'cancelled', 'expired'], default: 'pending' },
  expiresAt: { type: Date, required: true }, invitedBy: Schema.Types.ObjectId, acceptingUntil: Date,
}, { timestamps: true });
invitation.index({ workspaceId: 1, email: 1 }, { unique: true, partialFilterExpression: { state: 'pending' } });
const billingEvent = new Schema({ _id: String, subscriptionId: String, createdAt: { type: Date, default: Date.now } });
const oauthFlow = new Schema({
  provider: { type: String, enum: ['google', 'apple'], required: true },
  purpose: { type: String, enum: ['signup', 'login'], required: true },
  stateHash: { type: String, required: true, unique: true, select: false },
  proofHash: { type: String, required: true, select: false }, nonceHash: { type: String, required: true, select: false },
  pkceVerifier: { type: String, select: false },
  ticketHash: { type: String, unique: true, sparse: true, select: false },
  status: { type: String, enum: ['pending', 'exchanging', 'ready', 'completing', 'consumed', 'failed'], default: 'pending' },
  profile: { subject: String, email: String, firstName: String, lastName: String },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
oauthFlow.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = {
  Account: globalModel('SaaSAccount', account), Workspace: globalModel('SaaSWorkspace', workspace),
  Membership: globalModel('SaaSMembership', membership), Invitation: globalModel('SaaSInvitation', invitation),
  BillingEvent: globalModel('SaaSBillingEvent', billingEvent),
  OAuthFlow: globalModel('SaaSOAuthFlow', oauthFlow),
};
