# WMS - Warehouse Management System

A Next.js 14 web application for managing inbound warehouse operations.

## Features
- Vehicle Entry (IB-01)
- GRN Entry (IB-02)
- Vehicle Checklist (IB-03)
- Pallet Build — Single & Multi (IB-04)
- Putaway (IB-05)
- GRN Issue (IB-06)

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/apps-Crystal/WMS-Detroj_Test)

### Steps:
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import from GitHub: `apps-Crystal/WMS-Detroj_Test`
3. Set **Root Directory** to `.` (leave blank — repo root)
4. Add these **Environment Variables** under Project Settings:

| Variable | Value |
|---|---|
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | any random 32+ char string |
| `GOOGLE_SHEET_ID` | your Google Sheet ID |
| `GOOGLE_DRIVE_FOLDER_ID` | your Drive folder ID |
| `APPS_SCRIPT_URL` | your Apps Script Web App URL |

5. Click **Deploy** ✅

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/apps-Crystal/WMS-Detroj_Test.git
cd WMS-Detroj_Test

# 2. Install dependencies
npm install

# 3. Copy env file
cp .env.example .env.local
# → Fill in your values in .env.local

# 4. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Tech Stack
- **Next.js 14** (App Router)
- **NextAuth.js** (Authentication)
- **Tailwind CSS** + Shadcn UI
- **Google Apps Script** (Backend / Google Sheets)
- **Google Sheets GViz API** (Data Fetching)
