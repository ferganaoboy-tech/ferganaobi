# OBOI CRM

Devor qog'ozi (oboi) savdo kompaniyasi uchun to'liq funksional CRM tizimi.

## 📦 Texnologiyalar

| Layer | Stack |
|---|---|
| Backend | Node.js, Express 5, MongoDB (Mongoose) |
| Frontend | React 19, Vite, TailwindCSS v4, TanStack Query |
| Real-time | Socket.io |
| AI | Groq API (Llama 3.3 70B) |
| Storage | Cloudinary (rasm yuklash) |
| Notifications | Telegram Bot |
| Hosting | Render.com (backend), Vercel (frontend) |

## 🏗️ Arxitektura

```
crm oboi/
├── backend/
│   ├── controllers/     # HTTP handler'lar (biznes logika yupqa)
│   ├── services/        # Asosiy biznes logika (orderService.js)
│   ├── models/          # Mongoose schema'lar
│   ├── routes/          # Express router'lar
│   ├── middleware/      # auth, upload
│   ├── utils/           # logger, telegramBot, unitConverter
│   ├── jobs/            # node-cron (kunlik hisobot)
│   ├── events/          # EventEmitter (stock, order events)
│   └── server.js        # Entry point
└── frontend/
    ├── src/
    │   ├── api/         # Axios instance + barcha API call'lar
    │   ├── components/  # UI komponentlar
    │   ├── contexts/    # AuthContext, CartContext
    │   ├── hooks/       # TanStack Query hooks
    │   ├── pages/       # Sahifalar
    │   └── utils/       # Yordamchi funksiyalar
    └── vite.config.js
```

## 🚀 Local Setup

### Talablar

- Node.js >= 18
- MongoDB Atlas klaster (yoki local MongoDB replica set — transactions uchun)
- Cloudinary account
- Groq API key (bepul)

### 1. Clone va install

```bash
git clone <repo-url>
cd crm-oboi

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Environment variables

```bash
# backend/.env faylini yarating
cp backend/.env.example backend/.env
# Keyin qiymatlrini to'ldiring
```

Muhim ENV variable'lar:

| Variable | Tavsif | Majburiy |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | ✅ |
| `JWT_SECRET` | Access token signing key | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token signing key | ✅ |
| `NODE_ENV` | `development` yoki `production` | ✅ |
| `CLIENT_URL` | Frontend URL (CORS uchun) | ✅ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | ✅ |
| `CLOUDINARY_API_KEY` | Cloudinary API key | ✅ |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | ✅ |
| `GROQ_API_KEY` | Groq AI API key | ⚠️ (AI sahifasi uchun) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | ⚠️ (bildirishnomalar uchun) |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | ⚠️ (bildirishnomalar uchun) |
| `DEFAULT_ADMIN_USERNAME` | Default admin login | ✅ |
| `DEFAULT_ADMIN_PASSWORD` | Default admin parol | ✅ |

### 3. Ishga tushirish

```bash
# Backend (port 5000)
cd backend
npm run dev

# Frontend (port 5173)
cd frontend
npm run dev
```

Brauzerda: `http://localhost:5173`

## 🔐 Autentifikatsiya

Tizim ikki bosqichli token mexanizmidan foydalanadi:

- **Access token** (15 daqiqa) — `Authorization: Bearer <token>` header'ida
- **Refresh token** (7 kun) — `HttpOnly` cookie'da (JS'dan o'qib bo'lmaydi)

Token muddati o'tganda frontend avtomatik `/api/auth/refresh` chaqiradi va yangi access token oladi. Refresh token ham o'tgan bo'lsa — login sahifasiga yo'naltiriladi.

## 👤 Rollar va Ruxsatlar

| Rol | Kirish huquqlari |
|---|---|
| `superadmin` | Barcha funksiyalar + tizim sozlamalari + reset |
| `admin` | Foydalanuvchilar boshqaruvi + barcha savdo operatsiyalari |
| `manager` | Hisobotlar, AI tahlil, savdo operatsiyalari |
| `cashier` | Savdo, to'lovlar, qaytarishlar |
| `warehouse` | Faqat o'z omboridagi mahsulotlar |

## 📡 API Endpointlar

| Prefix | Tavsif | Auth |
|---|---|---|
| `POST /api/auth/login` | Tizimga kirish | ❌ |
| `POST /api/auth/refresh` | Access token yangilash | Cookie |
| `POST /api/auth/logout` | Chiqish | ❌ |
| `GET /api/auth/me` | Joriy foydalanuvchi | ✅ |
| `GET/POST /api/products` | Mahsulotlar CRUD | ✅ |
| `GET/POST /api/orders` | Buyurtmalar CRUD | ✅ |
| `GET/POST /api/payments` | To'lovlar | ✅ |
| `GET/POST /api/returns` | Qaytarishlar | ✅ |
| `GET/POST /api/customers` | Mijozlar | ✅ |
| `GET/POST /api/warehouses` | Omborlar | ✅ |
| `GET/POST /api/users` | Xodimlar (admin) | ✅ Admin |
| `GET /api/audit-logs` | Audit jurnal (admin) | ✅ Admin |
| `GET /api/ai/analytics` | AI tahlil | ✅ Manager+ |
| `POST /api/reset-all` | Bazani tozalash | ✅ Superadmin |

## 🔄 Render.com Deploy (Keep-Alive)

Render free tier servis 15 daqiqada so'rersiz uyquga ketadi. Server ichida self-ping **anti-pattern** hisoblanadi.  
To'g'ri yondashuv: **[UptimeRobot](https://uptimerobot.com)** (bepul) orqali 5 daqiqada bir external ping.

Setup:
1. UptimeRobot'ga kiring
2. "New Monitor" → HTTP(s) Monitor
3. URL: `https://your-app.onrender.com`
4. Monitoring Interval: 5 minutes

## ⚠️ Muhim Eslatmalar

- MongoDB transactions ishlashi uchun **Replica Set** kerak (MongoDB Atlas bu talabni avtomatik qondiradi)
- Local dev uchun `mongod --replSet rs0` yoki Docker bilan Mongo replica set ishga tushiring
- `.env` faylini **hech qachon** git'ga push qilmang
