# سامانه فروش بلیت تئاتر

سورس کامل: پنل مدیر، کارگردان، باجه فروش و کنترل ورود (TanStack Start + React + Tailwind v4).

## ساختار
- `src/` — صفحات، اجزا، استایل (`src/styles.css` شامل رنگ‌ها و تم)، توابع سرور
- `public/` — favicon و robots
- `database/schema.sql` — ساختار کامل دیتابیس (جداول، تریگرها، RLS، توابع) به‌ترتیب migrationها
- `drizzle/migrations/` — migrationهای جداگانه
- `Dockerfile`, `docker-compose.yml` — استقرار روی سرور شخصی
- `.env.example` — نمونه متغیرهای محیطی (بدون مقدار واقعی)

## وابستگی‌های خارجی
- **دیتابیس و احراز هویت:** Supabase (ابری یا self-hosted). برنامه به `auth.users` و Postgres نیاز دارد.
- **فونت:** فونت سیستمی (Vazirmatn در صورت نصب، سپس Tahoma) — بدون دانلود خارجی.
- **آیکون‌های PWA پنل‌ها، ایمیل بازیابی، پلن‌های اشتراک:** داخل جدول‌های `app_settings` و `subscription_plans` ذخیره‌اند و جزو داده‌اند، نه سورس (پایین را ببینید).

## اجرای محلی
```sh
cp .env.example .env   # مقادیر را پر کنید
bun install            # یا npm install
bun run dev
```

## راه‌اندازی دیتابیس
1. یک پروژه Supabase بسازید (یا self-hosted نصب کنید).
2. محتوای `database/schema.sql` را در SQL editor یا با `psql` اجرا کنید:
   `psql "$DATABASE_URL" -f database/schema.sql`
3. در تنظیمات Auth، ورود ایمیل/رمز را فعال کنید.
4. حساب مدیر را با ثبت‌نام بسازید و نقش `admin` را در جدول `user_roles` برایش درج کنید.

## انتقال داده‌های واقعی (اختیاری)
- از دیتابیس فعلی خروجی بگیرید (در Lovable: Cloud → Advanced settings → Export data، یا `pg_dump --data-only --schema=public`).
- پس از اجرای schema، داده‌ها را وارد کنید: `psql "$DATABASE_URL" -f data.sql`
- کاربران احراز هویت (رمزها) قابل انتقال مستقیم نیستند؛ کاربران دوباره ثبت‌نام کنند.
- آیکون‌های پنل‌ها در `app_settings` هستند؛ با انتقال این جدول حفظ می‌شوند یا دوباره از پنل مدیر آپلود کنید.

## ساخت و استقرار production
### با Docker
```sh
cp .env.example .env   # پر کنید
docker compose up -d --build
```
برنامه روی پورت 3000 اجرا می‌شود؛ Nginx/Caddy را جلوی آن برای دامنه و HTTPS قرار دهید.

### بدون Docker
```sh
bun install
NITRO_PRESET=node-server bun run build
PORT=3000 node .output/server/index.mjs
```

## بررسی یکسان‌بودن ظاهر
صفحات `/admin/login`، `/admin/dashboard`، `/director/dashboard`، `/booth/{token}`، `/entry/{token}` را در موبایل (۳۹۰px) و دسکتاپ با نسخه فعلی مقایسه کنید.

## امنیت
فایل `.env` واقعی و کلید `SUPABASE_SERVICE_ROLE_KEY` را هرگز commit نکنید.
