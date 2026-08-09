const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  startingCash: {
    type: Number,
    required: true,
    default: 0,
  },
  cashSales: {
    type: Number,
    default: 0,
  },
  cashReturns: {
    type: Number,
    default: 0,
  },
  expectedCash: {
    type: Number,
  },
  actualCash: {
    type: Number,
  },
  difference: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },
  notes: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model('Shift', shiftSchema);
