require('dotenv').config();
const express = require('express');
const { sendTextMessage, parseIncomingMessage } = require('./whatsapp');
const { handleCustomerMessage } = require('./agent');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post('/webhook', async (req, res) => {
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');

  try {
    const parsed = parseIncomingMessage(req.body);
    if (!parsed || !parsed.text) return;

    const { from, text } = parsed;
    console.log(`Incoming from ${from}: ${text}`);

    const reply = await handleCustomerMessage(from, text);
    await sendTextMessage(from, reply);
    console.log(`Replied to ${from}: ${reply}`);
  } catch (err) {
    console.error('Error handling incoming webhook:', err.message);
    try {
      const parsed = parseIncomingMessage(req.body);
      if (parsed?.from) {
        await sendTextMessage(parsed.from, 'معلش حصل عندنا ضغط بسيط دلوقتي، ممكن تعيد رسالتك تاني؟ 🙏');
      }
    } catch (fallbackErr) {
      console.error('Fallback reply also failed:', fallbackErr.message);
    }
  }
});

app.get('/', (req, res) => res.send('Egy France WhatsApp bot is running.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
