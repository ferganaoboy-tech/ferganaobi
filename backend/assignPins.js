const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const generateUniquePin = async () => {
  let isUnique = false;
  let pin;
  while (!isUnique) {
    pin = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit pin
    const exists = await User.findOne({ pin });
    if (!exists) {
      isUnique = true;
    }
  }
  return pin;
};

async function assignPins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');

    const users = await User.find({ pin: { $exists: false } });
    console.log(`Found ${users.length} users without a PIN.`);

    for (const user of users) {
      const pin = await generateUniquePin();
      user.pin = pin;
      await user.save();
      console.log(`Assigned PIN ${pin} to ${user.username} (${user.role})`);
    }

    console.log('All users have been assigned a PIN successfully.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

assignPins();
