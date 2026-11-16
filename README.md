# Takwira24

تطبيق رياضي تونسي يجمع اللاعبين، ويسهّل اكتشاف المباريات وتكوين الفرق.

## التقنيات
- React + Vite لواجهة Mobile-first باللغة العربية وRTL.
- Supabase للتحضير للمصادقة وقاعدة البيانات والتخزين والتحديثات الفورية.
- Capacitor 7 لتحويل تطبيق الويب إلى تطبيق Android.
- PWA manifest + service worker للنسخة القابلة للتثبيت من المتصفح.

## تشغيل نسخة الويب
```bash
npm install
npm run dev
```

## إعداد Supabase
1. أنشئ مشروعاً في Supabase.
2. نفّذ ملف `supabase/schema.sql` من SQL Editor.
3. انسخ `.env.example` إلى `.env` وأضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.
4. فعّل طرق تسجيل الدخول المطلوبة واضبط Storage buckets للصور.

## بناء Android
يتطلب Android Studio وAndroid SDK على جهاز التطوير:
```bash
npm install
npx cap add android
npm run cap:sync
npm run android
``
بعدها افتح مشروع Android في Android Studio، اختبره على جهاز حقيقي، واضبط package id ونسخة التطبيق والتوقيع قبل إنشاء Android App Bundle (AAB) للنشر على Google Play.

## نشر نسخة الويب
GitHub Actions يبني نسخة GitHub Pages مع المسار الصحيح تلقائياً. النسخة المنشورة للمعاينة لا تعني أن ملف Android AAB قد تم إنشاؤه أو نشره.

## الوضع الحالي
- واجهة RTL Mobile-first مع هوية رياضية أوضح.
- اكتشاف مباريات كرة القدم واليد والسلة والطائرة.
- إنشاء مباراة ببياناتها الأساسية.
- بحث اللاعبين.
- تحرير بطاقة اللاعب محلياً في الواجهة.
- وضع تجريبي عند عدم إعداد مفاتيح Supabase.

## ما يزال مطلوباً قبل الإطلاق
- ربط تسجيل الدخول والملف الشخصي فعلياً بـ Supabase.
- حفظ الملف والصور والاشتراكات والدعوات في قاعدة البيانات.
- اختبار Capacitor على Android وإكمال إعدادات التوقيع وGoogle Play.
