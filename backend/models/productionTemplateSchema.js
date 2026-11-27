const mongoose = require('mongoose');

const stage = new mongoose.Schema(
  { title: String, category: String, dueDays: Number, clientVisible: Boolean }, { _id: false },
);
module.exports = new mongoose.Schema(
  { id: String, name: String, stages: [stage] }, { _id: false },
);
