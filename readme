# 🏪 SwiftPOS — Complete Point of Sale System

A production-ready PWA POS system built with Node.js, Express, MongoDB, and vanilla JS.
Runs in the browser and as an Android app via WebView.

---

## 📁 Full Project Structure

```
pos-system/
├── backend/
│   ├── config/                  # (future: DB config separation)
│   ├── controllers/
│   │   ├── authController.js    # Login, register, JWT
│   │   ├── productController.js # Full product CRUD
│   │   ├── transactionController.js # Sales + stock deduction
│   │   └── dashboardController.js   # Analytics & KPIs
│   ├── middleware/
│   │   └── auth.js              # JWT verify + RBAC
│   ├── models/
│   │   ├── User.js              # bcrypt hashed passwords
│   │   ├── Product.js           # Stock tracking, barcode
│   │   ├── Category.js          # Color-coded categories
│   │   └── Transaction.js       # Complete sales records
│   ├── routes/
│   │   ├── auth.js              # POST /login, /register
│   │   ├── products.js          # CRUD + barcode lookup
│   │   ├── categories.js        # Category CRUD
│   │   ├── transactions.js      # Sales history + void
│   │   ├── dashboard.js         # Analytics endpoints
│   │   ├── users.js             # User management (admin)
│   │   └── inventory.js         # Stock alerts
│   ├── utils/
│   │   └── seed.js              # Database seeder
│   ├── server.js                # Express app entry point
│   ├── package.json
│   └── .env                     # Environment variables
│
├── frontend/
│   ├── css/
│   │   └── main.css             # Full design system
│   ├── js/
│   │   ├── utils/
│   │   │   ├── api.js           # HTTP client + offline detection
│   │   │   ├── storage.js       # localStorage + IndexedDB queue
│   │   │   ├── sync.js          # Offline → online sync
│   │   │   └── receipt.js       # Print + PDF export
│   │   ├── modules/
│   │   │   ├── auth.js          # Login/register screens
│   │   │   ├── dashboard.js     # KPI + Chart.js
│   │   │   ├── pos.js           # Main POS register
│   │   │   ├── products.js      # Product management
│   │   │   ├── transactions.js  # History + void
│   │   │   └── inventory.js     # Stock alerts
│   │   └── app.js               # Router + PWA bootstrap
│   ├── icons/                   # PWA icons (SVG/PNG)
│   ├── index.html               # SPA shell
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service Worker
│
├── android/
│   ├── MainActivity.kt          # WebView container
│   ├── activity_main.xml        # Layout
│   ├── AndroidManifest.xml      # Permissions
│   ├── build.gradle             # Dependencies
│   ├── network_security_config.xml
│   └── themes.xml               # App theme
│
├── generate-icons.js            # Icon generator script
└── README.md                    # This file
```

---

## ⚡ Quick Start

### Prerequisites

| Tool       | Version  | Install                          |
|------------|----------|----------------------------------|
| Node.js    | 18+      | https://nodejs.org               |
| MongoDB    | 6+       | https://www.mongodb.com/try/download |
| npm        | 8+       | Included with Node.js            |

---

## 🗄️ Step 1 — MongoDB Setup

### Option A: Local MongoDB (Recommended for development)

```bash
# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Windows
# Download installer from https://www.mongodb.com/try/download/community
# Run installer → select "Complete" → check "Install MongoDB as a Service"
```

Verify it's running:
```bash
mongosh
# Should show MongoDB shell prompt
> show dbs
```

### Option B: MongoDB Atlas (Cloud - Free tier)

1. Go to https://cloud.mongodb.com → Create free account
2. Create a new cluster (M0 Free Tier)
3. Database Access → Add user with password
4. Network Access → Add `0.0.0.0/0` (allow all IPs)
5. Click "Connect" → "Connect your application" → Copy connection string
6. Paste it in `.env` as `MONGODB_URI`

---

## 🚀 Step 2 — Running the Backend

```bash
# 1. Navigate to backend
cd pos-system/backend

# 2. Install dependencies
npm install

# 3. Configure environment
# Edit .env with your settings:
nano .env
# OR copy and edit:
cp .env .env.local

# 4. Seed the database (creates admin + sample data)
npm run seed

# 5. Start the server
npm start
# OR for development with auto-restart:
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 POS Server running on port 5000
📱 Environment: development
🌐 API: http://localhost:5000/api
```

Test the API:
```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"POS API is running",...}
```

---

## 🌐 Step 3 — Running the Frontend

The frontend is served **automatically** by the backend from the `frontend/` directory.

```bash
# Open in browser:
http://localhost:5000

# Test on mobile (same WiFi network):
http://YOUR_COMPUTER_IP:5000
```

### Default Login Credentials (after seeding):
| Role     | Email                | Password     |
|----------|----------------------|--------------|
| Admin    | admin@pos.com        | Admin@123    |
| Cashier  | cashier@pos.com      | Cashier@123  |

---

## 📱 Step 4 — Android Studio Setup

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer
- Android SDK API 21+ (Android 5.0)
- JDK 17+

### Setup Steps

**1. Create new Android project in Android Studio:**
```
File → New → New Project → Empty Activity
Name: SwiftPOS
Package: com.swiftpos.app
Language: Kotlin
Min SDK: API 21 (Android 5.0)
```

**2. Copy the android files:**
```
android/MainActivity.kt     → app/src/main/java/com/swiftpos/app/
android/activity_main.xml   → app/src/main/res/layout/
android/AndroidManifest.xml → app/src/main/
android/build.gradle        → app/   (merge with existing)
android/network_security_config.xml → app/src/main/res/xml/
android/themes.xml          → app/src/main/res/values/themes.xml (replace)
```

**3. Update `app/build.gradle` dependencies:**
```groovy
dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
```

**4. Set your server URL in `MainActivity.kt`:**
```kotlin
// For Android emulator (uses host machine's localhost):
private val SERVER_URL = "http://10.0.2.2:5000"

// For physical device (same WiFi network):
private val SERVER_URL = "http://192.168.1.100:5000"  // your computer's IP
```

**5. Find your computer's IP:**
```bash
# macOS / Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows:
ipconfig | findstr "IPv4"
```

**6. Run on emulator:**
```
Run → Run 'app' → Select emulator/device → OK
```

---

## 📦 Step 5 — Build APK

### Debug APK (for testing):
```
Build → Build Bundle(s)/APK(s) → Build APK(s)
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (for distribution):

**1. Generate a signing keystore:**
```bash
keytool -genkey -v \
  -keystore swiftpos.keystore \
  -alias swiftpos \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**2. Configure signing in `app/build.gradle`:**
```groovy
android {
    signingConfigs {
        release {
            storeFile file('../swiftpos.keystore')
            storePassword 'your_keystore_password'
            keyAlias 'swiftpos'
            keyPassword 'your_key_password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
        }
    }
}
```

**3. Build signed release APK:**
```
Build → Generate Signed Bundle/APK → APK → Select keystore → Release → Finish
# Output: app/build/outputs/apk/release/app-release.apk
```

**4. Install APK on device:**
```bash
adb install app/build/outputs/apk/release/app-release.apk
```

---

## 🔧 Configuration Reference

### Backend `.env` Variables

```env
# Server
PORT=5000
NODE_ENV=development          # or production

# Database
MONGODB_URI=mongodb://localhost:27017/pos_system

# JWT (CHANGE THIS IN PRODUCTION - min 32 chars)
JWT_SECRET=your_super_secret_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d

# CORS - your frontend URL
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
RATE_LIMIT_MAX=100            # requests per window

# Business Info (appears on receipts)
BUSINESS_NAME=My Store
BUSINESS_ADDRESS=123 Main St, City
BUSINESS_PHONE=+1234567890
BUSINESS_TIN=000-000-000
TAX_RATE=0.12                 # 12% VAT
```

### Frontend Config (Settings page or `window._POS_CONFIG`):

```javascript
window._POS_CONFIG = {
    apiUrl: 'http://localhost:5000/api',
    businessName: 'My Store',
    businessAddress: '123 Main St',
    businessPhone: '+1234567890',
    taxRate: 0.12,
};
```

---

## 🌐 Complete API Reference

### Authentication
| Method | Endpoint                    | Auth   | Description          |
|--------|-----------------------------|--------|----------------------|
| POST   | `/api/auth/login`           | None   | Login → returns JWT  |
| POST   | `/api/auth/register`        | None*  | Register new user    |
| GET    | `/api/auth/me`              | JWT    | Get current user     |
| PUT    | `/api/auth/change-password` | JWT    | Change password      |

### Products
| Method | Endpoint                       | Role     | Description              |
|--------|--------------------------------|----------|--------------------------|
| GET    | `/api/products`                | Any      | List products (paginated)|
| GET    | `/api/products/:id`            | Any      | Get single product       |
| GET    | `/api/products/barcode/:code`  | Any      | Lookup by barcode        |
| POST   | `/api/products`                | Admin    | Create product           |
| PUT    | `/api/products/:id`            | Admin    | Update product           |
| PATCH  | `/api/products/:id/stock`      | Admin    | Adjust stock             |
| DELETE | `/api/products/:id`            | Admin    | Soft delete              |

### Transactions
| Method | Endpoint                         | Role     | Description            |
|--------|----------------------------------|----------|------------------------|
| POST   | `/api/transactions`              | Any      | Create sale            |
| GET    | `/api/transactions`              | Any      | List transactions      |
| GET    | `/api/transactions/:id`          | Any      | Get transaction detail |
| PATCH  | `/api/transactions/:id/void`     | Admin    | Void + restore stock   |
| GET    | `/api/transactions/summary/chart`| Any      | Sales chart data       |

### Dashboard
| Method | Endpoint                          | Role | Description           |
|--------|-----------------------------------|------|-----------------------|
| GET    | `/api/dashboard/summary`          | Any  | KPIs + recent data    |
| GET    | `/api/dashboard/chart?days=7`     | Any  | Sales chart by period |
| GET    | `/api/dashboard/payment-breakdown`| Any  | Payment method totals |

### Inventory
| Method | Endpoint                  | Role | Description         |
|--------|---------------------------|------|---------------------|
| GET    | `/api/inventory/summary`  | Any  | Stock overview      |
| GET    | `/api/inventory/low-stock`| Any  | Low stock products  |
| GET    | `/api/inventory/out-of-stock` | Any | OOS products    |

### Categories
| Method | Endpoint              | Role  | Description      |
|--------|-----------------------|-------|------------------|
| GET    | `/api/categories`     | Any   | List categories  |
| POST   | `/api/categories`     | Admin | Create category  |
| PUT    | `/api/categories/:id` | Admin | Update category  |
| DELETE | `/api/categories/:id` | Admin | Delete category  |

---

## 📶 Offline Mode

SwiftPOS supports full offline operation:

1. **Service Worker** caches all static assets + API GET responses
2. **IndexedDB Queue** stores offline transactions locally
3. **Auto-Sync** — when connection restores, queued transactions sync automatically
4. **Background Sync API** triggers sync even when app is backgrounded

### How it works:
```
Online:  Browser → API → MongoDB (normal)
Offline: Browser → IndexedDB Queue → localStorage receipt
Restore: IndexedDB → API → MongoDB (auto-sync)
```

---

## 🔒 Security Features

| Feature              | Implementation                              |
|----------------------|---------------------------------------------|
| Password hashing     | bcrypt with 12 salt rounds                  |
| JWT authentication   | 7-day expiry, Bearer token                  |
| NoSQL injection      | express-mongo-sanitize middleware           |
| XSS protection       | Helmet.js headers + HTML escaping in JS     |
| Rate limiting        | express-rate-limit (100 req/15min)          |
| Input validation     | express-validator on all POST/PUT routes    |
| CORS                 | Whitelist only trusted origins              |
| Role-based access    | Middleware guards on admin-only routes      |

---

## 📱 PWA Installation

### Android (Chrome):
1. Open `http://YOUR_IP:5000` in Chrome
2. Chrome shows "Add to Home Screen" banner
3. Tap "Install" → App appears on home screen

### iOS (Safari):
1. Open in Safari
2. Tap Share → "Add to Home Screen"
3. Name it → Add

### Desktop (Chrome/Edge):
1. Look for install icon in address bar
2. Click → Install

---

## 🛠️ Development Tips

### Running both frontend and backend:
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: No separate frontend server needed!
# Backend serves frontend at http://localhost:5000
```

### Using a separate frontend dev server (optional):
```bash
# If you want hot-reload for frontend changes:
cd frontend && npx serve -l 3000
# Update FRONTEND_URL in .env to http://localhost:3000
```

### Reset database:
```bash
cd backend && npm run seed
# Deletes everything and recreates demo data
```

### View MongoDB data:
```bash
# Use MongoDB Compass (GUI): https://www.mongodb.com/products/compass
# Or Mongo Shell:
mongosh pos_system
> db.products.find().pretty()
> db.transactions.find().sort({createdAt:-1}).limit(5).pretty()
```

### Testing API with curl:
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pos.com","password":"Admin@123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Get products
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/products

# Create transaction
curl -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"product":"PRODUCT_ID","quantity":2}],"paymentMethod":"cash","amountTendered":300}'
```

---

## 🚢 Production Deployment

### Backend on VPS (Ubuntu):
```bash
# 1. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install MongoDB
# Follow: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/

# 3. Clone project and install
git clone <your-repo>
cd pos-system/backend
npm install --production

# 4. Set NODE_ENV=production in .env
# CHANGE JWT_SECRET to a strong random value!
openssl rand -base64 64  # Generate a strong secret

# 5. Use PM2 for process management
npm install -g pm2
pm2 start server.js --name swiftpos
pm2 startup  # Auto-start on reboot
pm2 save

# 6. Nginx reverse proxy (optional, for port 80)
sudo apt install nginx
# Configure /etc/nginx/sites-available/swiftpos
```

### Nginx config example:
```nginx
server {
    listen 80;
    server_name yourpos.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `MongoDB connection failed` | Ensure MongoDB is running: `sudo systemctl start mongodb` |
| `Port 5000 already in use` | `lsof -ti:5000 \| xargs kill -9` or change `PORT` in `.env` |
| `Android can't connect` | Use `10.0.2.2` for emulator, device's IP for physical phone |
| `CORS error in browser` | Add your frontend URL to `FRONTEND_URL` in `.env` |
| `JWT expired` error | Login again, or increase `JWT_EXPIRES_IN` in `.env` |
| PWA not installing | Must be served over HTTPS in production (or localhost for dev) |
| `Cannot find module` | Run `npm install` in the `backend/` folder |

---

## 📄 License

MIT License — free for commercial use.

---

## 🤝 Credits

Built with:
- **Express.js** — Web framework
- **Mongoose** — MongoDB ODM  
- **Chart.js** — Dashboard charts
- **jsPDF** — PDF receipt export
- **bcryptjs** — Password hashing
- **jsonwebtoken** — JWT auth
