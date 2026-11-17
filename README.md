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

## ربط Takwira24 بقاعدة Supabase خاصة بها

لا تستعمل قاعدة بيانات تطبيق Omra. أنشئ مشروعاً مستقلاً باسم Takwira24 في المنظمة التي تختارها.

1. من Supabase SQL Editor نفّذ `supabase/schema.sql` مرة واحدة على مشروع جديد وفارغ.
2. من Project Settings → API خذ رابط المشروع والمفتاح **publishable** (لا تستعمل service_role مطلقاً في المتصفح).
3. محلياً استعمل `.env` حسب `.env.example`. وفي GitHub → Settings → Secrets and variables → Actions خزّن:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (يمكن أن يكون المفتاح publishable)
4. من Authentication → URL Configuration ضع Site URL = `https://boumiza-1.github.io/Takwira24/` وأضف نفس العنوان إلى Redirect URLs (وأضف localhost عند التطوير).
5. فعّل Email authentication من Authentication → Providers. للتحقق من البريد أو استرجاع كلمة السر، تحتاج إعداد قالب ورسائل البريد الإلكتروني.
6. لتفعيل Facebook: أنشئ Meta for Developers app، فعّل Facebook Login، وخذ App ID وApp Secret. في Supabase → Authentication → Providers → Facebook فعّل المزود وضع المعرف والسر. في Meta أضف Callback URI المعروض من Supabase في Facebook Login → Valid OAuth Redirect URIs. لا تضع App Secret داخل GitHub أو كود الواجهة.
7. بعد الدفع إلى main، GitHub Actions ينشر الواجهة باستعمال Secrets. تحقق من تسجيل الدخول وإنشاء الحساب وتعديل الصورة وإنشاء ماتش على جهاز حقيقي.

## ما تم في هذه النسخة
- واجهة إنشاء حساب ودخول بريد إلكتروني وفيسبوك، واسترجاع كلمة السر.
- ملف لاعب مرتبط بجدول `profiles` مع تخزين صورة في bucket `avatars`.
- استكشاف ماتشات حقيقية وطلب الانضمام وإنشاء ماتش في قاعدة البيانات.
- معرض صور اللاعب عبر `posts` وbucket `player-media`.
- أربع رياضات في قاعدة البيانات: كرة القدم، اليد، السلة والطائرة.
- صور أغلفة رياضية من مصادر خارجية، قد تتطلب تأكيد الحقوق والتوافر قبل التوزيع التجاري.

**الاختبارات قبل الإنتاج:** التحقق من إعدادات Meta OAuth، سياسة الخصوصية، سياسات Storage وRLS، ومعدل رفع الصور، والاختبار على Android. هذه النسخة هي تكامل قيد التهيئة ولا تعني أن قاعدة البيانات الحية تم إنشاؤها.
