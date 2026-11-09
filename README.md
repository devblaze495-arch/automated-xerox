# CampusPrint Platform - Monorepo

A modular, production-ready campus print ordering platform consisting of an **Android Operator Companion Terminal Application** and a **Fastify + TypeScript + Prisma Backend Service** connected via a real-time persistent WebSocket agent gateway.

---

## 📁 Repository Layout

```
/
├── .gitignore                      # Root gitignore covering Node, Android/Gradle, OS, and env secrets
├── README.md                       # Monorepo architecture, environment setup, and running instructions
├── package.json                    # Monorepo root npm workspaces configuration
│
├── app/                            # Android Operator Companion Application (Kotlin + Jetpack Compose)
│   ├── build.gradle.kts            # Android application gradle config (Min SDK 26, Target SDK 34)
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml     # Network, foreground service, and notification permissions
│       ├── res/                    # Dark theme values, vector launcher icons, and XML backup rules
│       └── java/com/campusprint/bridge/
│           ├── CampusPrintApp.kt   # DI Container & Notification Channel initializer
│           ├── MainActivity.kt     # Compose Single-Activity Host
│           ├── data/               # Models, PreferencesRepository, WebSocketManager, DocumentDownloader
│           ├── service/            # PrintBridgeForegroundService, PrintBridgeManager
│           ├── util/               # PdfPrintDocumentAdapter (Android Print Spooler bridge)
│           └── ui/                 # Material 3 Minimalist Dark Theme, Setup & Dashboard screens
│
├── packages/
│   ├── backend/                    # Fastify + TypeScript + Prisma Backend Service
│   │   ├── .env.example            # Environment variables template
│   │   ├── .gitignore              # Package-specific gitignore
│   │   ├── package.json            # Node.js scripts (dev, build, start, prisma)
│   │   ├── tsconfig.json           # NodeNext TypeScript configuration
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Full PostgreSQL relational schema with all models & enums
│   │   │   └── seed.ts             # Database seeder for default Center, Operator, and Printer
│   │   ├── uploads/                # Local/mock storage directory for inspected PDFs
│   │   └── src/
│   │       ├── config/env.ts       # Zod-validated environment configuration
│   │       ├── db/prisma.ts        # Singleton PrismaClient with health verification
│   │       ├── routes/             # REST API routes (pricing, documents, orders, payments, agent)
│   │       ├── services/           # Pricing engine, document inspector, queue service
│   │       ├── ws/                 # WebSocket agent gateway & active registry pool
│   │       └── server.ts           # Fastify server entry point
│   │
│   └── web/                        # Next.js 14+ (App Router) Student Portal & Operator Console
│       ├── .env.local              # Client-side configuration (NEXT_PUBLIC_API_URL)
│       ├── package.json            # Next.js, React, Tailwind CSS, Lucide icons
│       ├── tailwind.config.ts      # Minimalist dark theme palette (slate-950, sky-500)
│       └── src/
│           ├── app/
│           │   ├── layout.tsx      # Root App Router layout
│           │   ├── student/        # Student portal: multi-file upload & live quote configurator
│           │   ├── orders/[id]/    # Live order tracker with 4-digit Collection OTP & stepper
│           │   ├── operator/       # Xerox centre operator workbench with queue management
│           │   └── admin/          # Admin rate card matrix & printer hardware registry
│           ├── components/         # Navbar, DocumentUploader, PrintConfigCard, CartDrawer, RazorpayModal
│           └── lib/                # Client-side API fetchers & TypeScript interfaces
```

---

## 🛡️ Strict .gitignore Protection

The root `.gitignore` enforces strict exclusion rules to prevent accidental commits of secrets and heavy build artifacts:
- **Secrets & Keys**: `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `*.p12`, `*.crt`, `credentials.json`, `jwt-*.key`.
- **Node & Workspaces**: `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo`, debug logs.
- **Android & Gradle**: `.gradle/`, `build/`, `**/build/`, `local.properties`, `*.apk`, `*.aab`, `*.dex`, `*.class`.
- **IDEs & OS Artifacts**: `.idea/`, `*.iml`, `.vscode/`, `.DS_Store`, `Thumbs.db`, `Desktop.ini`.

---

## ⚙️ Quick Start Guide

### Prerequisites
- **Node.js**: v20+ (tested on Node v20/v25 with npm)
- **PostgreSQL**: v14+ (optional for initial mock dev testing)
- **Redis**: v6+ (optional; automatic graceful in-memory fallback enabled)
- **Android Studio**: Jellyfish / Iguana / Koala / Ladybug for the Android companion app

---

### 1. Backend Service Setup (`packages/backend`)

#### Installation
```bash
# Navigate to backend package
cd packages/backend

# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate
```

#### Environment Configuration
Create `.env` from `.env.example`:
```ini
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
PUBLIC_BASE_URL=http://localhost:4000

# PostgreSQL Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/campus_print_db?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Operator Terminal Authentication Secret
AGENT_SECRET=campus_secret_key_123

# Local storage for uploaded PDF documents
UPLOAD_STORAGE_DIR=./uploads
```

#### Run Database Migrations & Seed (Optional)
```bash
# Push schema to local PostgreSQL
npm run prisma:push

# Seed default Print Center, Operator, and Printer
npm run prisma:seed
```

#### Start Backend in Development Mode
```bash
npm run dev
```

The server will spin up on `http://localhost:4000`.

---

### 2. Next.js 14+ Web Application (`packages/web`)

```bash
# Launch Next.js dev server on port 3000
npm run web:dev
```

Open `http://localhost:3000` in your browser:
- **Student Portal** (`/student`): Upload multiple PDFs, configure print settings, review real-time sheet pricing, and checkout with Razorpay simulation.
- **Order Tracking** (`/orders/[id]`): Displays 4-digit Collection OTP and live progress stepper.
- **Operator Workbench** (`/operator`): High-throughput Xerox queue with OTP verification and live terminal status.
- **Admin Settings** (`/admin`): Rate card matrix and hardware printer registry.

---

### 3. Android Operator App Setup (`app/`)

1. Open the project root (`B:\xerox`) in **Android Studio**.
2. Sync the project with Gradle.
3. Run on a **Physical Device** (via USB) or the **Android Emulator**:
   - **For Physical Devices (Default Mode)**: Connect phone via USB with USB Debugging enabled, and execute on your host machine:
     ```bash
     adb reverse tcp:4000 tcp:4000
     ```
     This routes all loopback traffic (`127.0.0.1:4000`) on the physical device directly to the Fastify backend on your PC.
   - **For Android Emulator**: Select the `Android Emulator (10.0.2.2:4000)` preset in the setup screen.
4. Configure connection parameters on the **Terminal Setup** screen:
   - **Server URL**: `ws://127.0.0.1:4000/api/v1/agent/socket` (Primary USB default) or `ws://10.0.2.2:4000/api/v1/agent/socket` (Emulator).
   - **Center ID**: `CTR-CAMPUS-01`
   - **Agent Secret**: `campus_secret_key_123`
5. Tap **Connect to Print Server**. The status indicator will turn vibrant green **CONNECTED**.

> [!NOTE]
> **Android PrintManager & Activity Lifecycle Handling**:
> Under Android's system framework, `PrintManager.print()` strictly validates `if (!(mContext instanceof Activity))` and throws `IllegalStateException: Can print only from an activity` if accessed via `ApplicationContext`. `PrintBridgeManager` resolves the active foreground `Activity` through `attachActivity()` / `detachActivity()` hooked into `MainActivity`'s lifecycle and Compose context unwrapping (`findActivity()`), ensuring native print spooler dialogs launch reliably from both foreground clicks and background WebSocket events. Predictive back gestures are cleanly enabled via `android:enableOnBackInvokedCallback="true"`.

---

## 📡 Live End-to-End Test Workflow

You can trigger a live print job dispatch to the connected Android companion terminal with a single HTTP request:

```bash
curl http://localhost:4000/api/v1/agent/test-dispatch
```

**What happens:**
1. Backend emits a `JOB_DISPATCHED` event through the WebSocket gateway.
2. The Android terminal receives the job and updates its queue card with:
   - Order Item ID (e.g., `#ORD-72762-ITEM-1`)
   - Document Name & Page Count
   - Badges: `B&W` / `COLOR`, `Duplex (Long Edge)`, `A4`, `x2 Copies`
3. Tap **"Download & Print"** on the Android terminal:
   - The app downloads the PDF from `http://10.0.2.2:4000/api/v1/documents/download/...` with a live progress bar.
   - The app verifies the `%PDF-` header and automatically launches the **Android System Print Dialog** via `PrintManager` and `PdfPrintDocumentAdapter`.
   - The Android app sends status updates (`PRINTING`, `COMPLETED`) back to the backend WebSocket in real time!

---

## 🧮 Pricing Engine Architecture (`src/services/pricing.service.ts`)

The pricing engine is **pure and deterministic**. It never trusts client-submitted prices:
- **Page Range Parser**: Accurately resolves complex range queries (e.g., `'1-5, 8, 11-14'` against total pages).
- **Physical Sheet Formula**:
  - `SIMPLEX`: $\text{sheets} = \text{effectivePages} \times \text{copies}$
  - `DUPLEX`: $\text{sheets} = \lceil \frac{\text{effectivePages}}{2} \rceil \times \text{copies}$
- **Cost Separation**:
  - **Paper Media Base Cost**: Per physical sheet (A4 vs A3).
  - **Toner Impression Cost**: Per printed page side (BW vs Color, A4 vs A3).

---

## 📑 REST API Documentation

### 1. Calculate Price Quote
- **POST** `/api/v1/pricing/calculate`
- **Request Body**:
```json
{
  "pageCount": 14,
  "pageRange": "1-5, 8, 11-14",
  "colorMode": "BW",
  "paperSize": "A4",
  "duplexMode": "DUPLEX_LONG",
  "copies": 2
}
```
- **Response**: Exact sheet count, total impressions, breakdown, and cents total.

### 2. Upload Document
- **POST** `/api/v1/documents/upload`
- **Multipart Form-Data**: `file` (PDF)
- **Response**: Validated page count, SHA-256 hash, and download URL.

### 3. Create Order
- **POST** `/api/v1/orders/create`
- **Response**: Created order in `PAYMENT_PENDING` state with an auto-generated 4-digit collection OTP.

### 4. WebSocket Agent Gateway
- **WS** `/api/v1/agent/socket`
- **Headers/Query**: `X-Center-ID`, `X-Agent-Secret`
