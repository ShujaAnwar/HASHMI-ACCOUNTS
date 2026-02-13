
import mongoose from 'mongoose';

const PaymentVoucherSchema = new mongoose.Schema({
  voucherNum: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  type: { type: String, default: 'PV' },
  currency: { type: String, enum: ['PKR', 'SAR'], required: true },
  roe: { type: Number, required: true },
  totalAmountPKR: { type: Number, required: true },
  description: { type: String, required: true },
  reference: String,
  status: { type: String, enum: ['POSTED', 'VOID'], default: 'POSTED' },
  
  // IAS 1 Accounting classification
  details: {
    expenseId: { type: String, required: true }, // Dr account
    bankId: { type: String, required: true },    // Cr account
    unitRate: { type: Number, required: true }
  },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('PaymentVoucher', PaymentVoucherSchema);
