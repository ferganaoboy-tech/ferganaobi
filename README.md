# 🏢 Fergana Oboi — Enterprise ERP & CRM System

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47A248?logo=mongodb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)

An enterprise-grade, highly scalable **Enterprise Resource Planning (ERP)** and **Customer Relationship Management (CRM)** application tailored for large-scale retail and wholesale inventory operations. 

Engineered with a strong emphasis on **Data Integrity (ACID), Financial Precision, Real-time Synchronization**, and **AI-Driven Automation**.

---

## 🏗 System Architecture & Technology Stack

The system is designed utilizing a modular monolith approach, separating concerns between a robust API service layer and a highly reactive client application.

### 🌐 Frontend (Client-Side)
- **Core Framework:** React 18 + Vite (Optimized for lightning-fast HMR and minimal bundle sizes).
- **State Management & Data Fetching:** **TanStack Query (React Query v5)** for intelligent caching, background synchronization, and Optimistic UI updates. Context API for global immutable state (Cart, Auth, Currency).
- **UI/UX & Styling:** Tailwind CSS combined with custom CSS modules and Headless UI patterns. Fully responsive, mobile-first design.
- **Data Visualization:** Recharts for complex financial reporting, donut charts, and trend analytics.
- **PWA (Progressive Web App):** Configured with Service Workers for offline resilience, caching strategies, and VAPID-based Web Push Notifications.
- **Real-Time Layer:** `socket.io-client` for instantaneous cross-client state synchronization (e.g., live dashboard updates, inventory depletion).

### ⚙️ Backend (Server-Side)
- **Runtime & API:** Node.js + Express.js configured with strict security headers (Helmet, CORS, Rate Limiting).
- **Database:** MongoDB configured as a **Replica Set** to support Distributed Transactions. Mongoose ODM for strict schema validation and lifecycle hooks.
- **Financial Integrity (ACID):** All critical financial mutations (Order processing, Refunds, Transfers) are wrapped in **MongoDB Transactions** (`session.withTransaction()`). This guarantees zero orphaned records or partial deductions in case of network drops or race conditions.
- **Authentication & Security:** JWT (JSON Web Tokens) implementing a robust Access/Refresh token rotation strategy. BCrypt for cryptographic password hashing.
- **AI Integration:** Google Gemini / GenAI models integrated for Natural Language Processing (NLP), transforming raw voice/text inputs directly into structured JSON payloads for the cart.
- **File Management:** Cloudinary integration for distributed CDN image hosting.

---

## 🚀 Core Features & Business Logic

### 1. 📊 Advanced Financial & Reporting Engine
- **Hybrid Currency System:** Seamless, real-time context switching between USD and UZS. Dynamic rate conversion algorithms built directly into the UI state, keeping backend ledgers normalized.
- **Smart Debt (Nasiya) Management:** Automatically computes customer balances based on partial payments (`qisman`). Dedicated endpoints for debt repayment tracking.
- **Cashback Ecosystem:** Business rules strictly define cashback accrual (only on 100% upfront cash payments) and redemption, calculating mathematically precise limits.
- **Excel Data Export (ExcelJS):** Senior-level report generation. Exports respect active filters, apply human-readable localization, and generate styled `.xlsx` sheets on-the-fly without locking the main thread.

### 2. 📦 Distributed Inventory Management (WMS)
- **Multi-Warehouse Architecture:** Strict data partitioning. Cashiers can only interact with their assigned warehouse, while Admins oversee aggregate multi-branch data.
- **Real-Time Transfers:** Secure inter-warehouse transfer protocols with multi-step confirmation states (Pending -> Accepted/Rejected).
- **Low-Stock Triggers:** Aggregation pipelines automatically detect and flag `stock <= minStock` triggers, notifying management instantly.

### 3. 🤖 AI-Powered Order Parsing
- **Voice-to-JSON Workflow:** Leverages AI to process complex, unstructured bulk orders (e.g., *"give me 5 rolls of brick wallpaper and 2 glue"*). The AI parses phrasing, matches SKUs, and normalizes quantities straight into the Point of Sale (POS) cart.

### 4. 🔐 Granular Role-Based Access Control (RBAC)
- **Strict Role Hierarchy:** `superadmin` > `admin` > `cashier`.
- Middleware layers validate not only the JWT signature but also the specific clearance level required for every endpoint route (`authorizeWithPermission`).

---

## 🛠 Local Development Guide

### Prerequisites
- **Node.js**: v18.x or v20.x LTS
- **MongoDB**: A running instance (Atlas cloud or Local). *Note: Local instances MUST be initiated as a Replica Set to support ACID Transactions (`rs.initiate()`).*

### 1. Repository Setup
```bash
git clone https://github.com/ferganaoboy-tech/ferganaobi.git
cd ferganaobi
```

### 2. Backend Initialization
```bash
cd backend
npm install
```
Create the environment file:
```bash
cp .env.example .env
```
**Critical `.env` Variables:**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ferganaoboi?replicaSet=rs0
JWT_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
GEMINI_API_KEY=your_google_ai_key
```
Start the development server (uses `nodemon`):
```bash
npm run dev
```

### 3. Frontend Initialization
```bash
cd ../frontend
npm install
```
Create the environment file:
```bash
cp .env.example .env
```
**Critical `.env` Variables:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```
Start the Vite HMR server:
```bash
npm run dev
```

---

## 🚢 Production Deployment Strategy

### Backend (Node.js API)
- Recommended to deploy on a VPS (Ubuntu) using **PM2** for process management and zero-downtime reloads, or via **Render/Railway** web services.
- **MongoDB Atlas** is highly recommended for production databases due to automated backups, clustering, and out-of-the-box transaction support.
- Ensure CORS in `app.js` is strictly whitelisted to the production frontend domain.

### Frontend (React/Vite PWA)
- Optimized for edge-network deployment on **Vercel** or **Netlify**.
- Build command:
  ```bash
  npm run build
  ```
- Make sure to configure rewrites/redirects for Single Page Applications (SPA) so that deep links resolve to `index.html`.

---

## 🧪 Testing & Code Quality
- **Error Handling:** Centralized `errorHandler` middleware standardizes API error responses and catches unhandled rejections gracefully.
- **Logging:** Custom logger utility tracks critical operational events (sales, deletions) for auditing purposes.

---
*Engineered by Fergana Oboi Tech. Built for performance, designed for scale.*
