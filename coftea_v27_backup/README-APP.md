# cof/tea Café POS — Cloud Shared Build

This build keeps the existing cof/tea POS layout/theme/features but moves the data layer to Supabase. The same app can be opened as a Windows Electron app or installed as a PWA on Android/tablet. Devices do not need to share Wi‑Fi; they only need internet access to the same Supabase project.

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `SUPABASE-SETUP.sql` completely. It creates the tables, RLS policies, sale/inventory RPCs, Realtime publication entries, and seeds the current 55 products and 46 inventory items.
4. In **Authentication → Users**, create these two users manually and set their metadata: 
   - owner@coftea.app / `owner123` / metadata `{"username":"owner","name":"Owner","role":"owner"}`
   - staff@coftea.app / `staff123` / metadata `{"username":"staff","name":"Staff","role":"staff"}`
   Turn on email auto-confirm for these accounts if your project requires it. The database trigger creates the matching `app_users` rows automatically.

## 2. Connect the app

Open `supabase-config.js` and replace:

- `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE` with your Supabase Project URL.
- `PASTE_YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY_HERE` with the public anon/publishable key.

Do **not** put the Supabase `service_role`/secret key in this app.

## 3. Windows EXE

Install Node.js LTS, then double-click `BUILD-WINDOWS.bat`. The generated installer is placed in `dist`.

## 4. Phone/tablet

Host this folder as a static HTTPS site. Open it on Android/Chrome and choose **Add to Home screen / Install app**. It will run as a standalone cof/tea POS app. Because data/auth live in Supabase, the phone, tablet, and PC use the same cloud data.

## 5. Realtime monitoring

After login, the app subscribes to Supabase Realtime for sales, sale items, expenses, inventory, products, historical records, report adjustments, and user records. A change made on another device triggers a refresh on the current device.

## 6. Daily Total Cash

Daily Sales now shows:

**Total Cash = Cash Paid − Expenses**

The value is calculated from the daily cash sales minus the daily expenses, exactly as requested.

## 7. Add-ons

The POS now includes:
- Whipped Cream — ₱10
- Oreo — ₱10

The existing add-ons remain unchanged.
