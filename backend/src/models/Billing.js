const mongoose = require('mongoose');

const billingInfoSchema = new mongoose.Schema({
  country: { type: String, default: 'India' },
  companyName: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  address2: { type: String, default: '' },
  pincode: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  plan: { type: String },
  licenses: { type: Number, default: 1 },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  cycle: { type: String, enum: ['Monthly', 'Quarterly', 'Annually'], default: 'Monthly' },
  status: { type: String, enum: ['Successful', 'Failed', 'Cancelled', 'Processing', 'Pending Payment'], default: 'Pending Payment' },
  gateway: { type: String, default: 'razorpay' },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const licenseSchema = new mongoose.Schema({
  plan: { type: String, default: 'Starter' },
  totalLicenses: { type: Number, default: 1 },
  usedLicenses: { type: Number, default: 0 },
  validUntil: { type: Date },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
}, { timestamps: true });

module.exports = {
  BillingInfo: mongoose.model('BillingInfo', billingInfoSchema),
  Transaction: mongoose.model('Transaction', transactionSchema),
  License: mongoose.model('License', licenseSchema),
};