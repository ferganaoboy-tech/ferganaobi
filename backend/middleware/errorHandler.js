const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Kutilmagan server xatoligi yuz berdi';

  // 1. Mongoose Bad ObjectId xatosi (Topilmadi)
  if (err.name === 'CastError') {
    message = `Ma'lumot topilmadi. Noto'g'ri ID formati kiritildi.`;
    statusCode = 404;
  }

  // 2. Mongoose Duplicate Key xatosi (Noyob maydon takrorlanishi)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message = `Kiritilgan "${field}" allaqachon tizimda mavjud. Iltimos boshqasini kiriting.`;
    statusCode = 400;
  }

  // 3. Mongoose Validation xatosi (Majburiy maydonlar)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    message = `Kiritilgan ma'lumotlarda xatolik: ${messages.join(', ')}`;
    statusCode = 400;
  }

  // 4. JWT Authentication xatolari
  if (err.name === 'JsonWebTokenError') {
    message = 'Avtorizatsiya xatosi: Token yaroqsiz. Tizimga qayta kiring.';
    statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Ruxsat muddati tugadi. Iltimos, tizimga qayta kiring.';
    statusCode = 401;
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    // Production muhitida stack yashiriladi
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
