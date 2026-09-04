# Supabase setup for cof/tea Café POS

## A. Supabase project
1. Create a project at Supabase.
2. Open SQL Editor.
3. Paste and run `SUPABASE-SETUP.sql`.
4. The script creates the POS tables and seeds 55 products + 46 inventory items.

## B. Login accounts
In Authentication > Users > Add user, create:

- Email: `owner@coftea.app`
- Password: `owner123`
- User metadata: `{"username":"owner","name":"Owner","role":"owner"}`

and:

- Email: `staff@coftea.app`
- Password: `staff123`
- User metadata: `{"username":"staff","name":"Staff","role":"staff"}`

Enable auto-confirm for these accounts if your project requires email confirmation.

## C. App connection
Edit `supabase-config.js`:

```js
window.COFTEA_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
window.COFTEA_SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY";
```

Never use a `service_role` or secret key in the app.

## D. Realtime
The SQL adds the POS tables to `supabase_realtime`. The app subscribes after login and refreshes the dashboard, sales, expenses, inventory, cup tracker and report pages when another device changes data.

## E. Phone/tablet
Deploy the folder as a static HTTPS site. On Android Chrome, use **Install app / Add to Home screen**. The PWA uses the same Supabase project as the Windows app.

## F. Windows EXE
Install Node.js LTS and run `BUILD-WINDOWS.bat`. The installer is generated in `dist`.
