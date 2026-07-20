# بوت واتساب - إيجي فرانس

سيرفر بسيط (Node.js) بيستقبل رسايل واتساب، يرد عليها بالعامية المصرية،
يجمع بيانات العميل، يرشحله باقة منتج، ويسجلها في Google Sheets.
مفيش n8n ولا نودز — كل حاجة كود واضح تحت تحكمك بالكامل.

---

## 1) قبل ما تبدأي: هتحتاجي 3 حاجات

1. **WhatsApp Business Cloud API** (من نفس الـ App: wahtschatbotegyfrance)
   - Access Token
   - Phone Number ID
2. **OpenAI API Key**
3. **Google Sheets Service Account** (خطوات عملها تحت في قسم 3)

---

## 2) تشغيل السيرفر محليًا (اختياري، للتجربة بس)

```bash
cd egyfrance-bot
npm install
cp .env.example .env
# افتحي .env واملي القيم الحقيقية
npm start
```

السيرفر هيشتغل على `http://localhost:3000`. لكن واتساب مش هيقدر يوصله لأنه لوكال —
عشان كده هننشره أونلاين في الخطوة الجاية.

---

## 3) عمل Google Sheets Service Account (5 دقايق، مرة واحدة بس)

1. روحي على [console.cloud.google.com](https://console.cloud.google.com)
2. اعملي مشروع جديد (أو استخدمي مشروع موجود)
3. من القايمة الجانبية: **APIs & Services > Library** → دوري على **Google Sheets API** → **Enable**
4. **APIs & Services > Credentials > Create Credentials > Service Account**
   - اديله اسم زي `egyfrance-bot`
   - بعد ما تعمليه، ادخلي عليه واعملي **Keys > Add Key > Create new key > JSON**
   - هينزلك ملف JSON — سميه `google-credentials.json` وحطيه في فولدر المشروع
5. افتحي ملف الـ JSON، هتلاقي فيه إيميل شكله كده:
   `egyfrance-bot@your-project.iam.gserviceaccount.com`
6. افتحي الـ **Google Sheet** بتاعتك، ودوسي **Share**، وحطي الإيميل ده بصلاحية **Editor**

---

## 4) نشر السيرفر أونلاين (Render.com — مجاني وسهل)

1. ارفعي فولدر المشروع على GitHub (لو مش عارفة، قوليلي وهساعدك)
2. روحي [render.com](https://render.com) → **New > Web Service** → اربطي الـ repo
3. الإعدادات:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. تحت **Environment Variables**، ضيفي كل القيم اللي في `.env.example` (القيم الحقيقية بتاعتك)
5. عشان ملف `google-credentials.json`:
   - افتحي محتوى الملف، وحطيه كله كـ Environment Variable باسم `GOOGLE_CREDENTIALS_JSON`
   - (هنعدل الكود بسيطة عشان يقراها من الـ variable ده بدل ملف — قوليلي لو عايزة الخطوة دي)
6. دوسي **Deploy**. بعد ما يخلص هيديكي رابط زي:
   `https://egyfrance-bot.onrender.com`

---

## 5) ربط الرابط بـ Meta (نفس الخطوة اللي كنا بنعملها في n8n، بس أسهل)

1. روحي **Meta for Developers > App wahtschatbotegyfrance > WhatsApp > Configuration**
2. **Callback URL:** `https://egyfrance-bot.onrender.com/webhook`
3. **Verify Token:** نفس القيمة اللي حطيتيها في `WHATSAPP_VERIFY_TOKEN`
4. دوسي **Verify and Save**
5. تأكدي إن **messages** مفعّل (Subscribed) تحت Webhook fields

---

## 6) التجربة

ابعتي رسالة من رقمك الشخصي (لازم يكون مضاف في **API Setup > To** لو التطبيق لسه Development mode).
هيرد عليكي البوت، يجمع بياناتك، ويسجلها في الشيت أوتوماتيك.

---

## هيكل المشروع

```
egyfrance-bot/
├── src/
│   ├── server.js     ← الويب سيرفر واستقبال رسايل واتساب
│   ├── agent.js       ← منطق الـ AI ومكالمة أداة تسجيل العميل
│   ├── whatsapp.js    ← إرسال/استقبال رسايل واتساب
│   └── sheets.js       ← الكتابة في Google Sheets
├── .env.example
├── package.json
└── README.md
```

## تعديلات شائعة

- **تغيير أسلوب الرد أو الأسئلة:** عدّلي `SYSTEM_PROMPT` في `src/agent.js`
- **تغيير أعمدة الشيت:** عدّلي `appendCustomerRow` في `src/sheets.js`
- **تغيير الموديل:** غيّري `OPENAI_MODEL` في `.env`
