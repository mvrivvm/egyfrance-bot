require('dotenv').config();
const express = require('express');
const { sendTextMessage, parseIncomingMessage } = require('./whatsapp');
const { handleCustomerMessage } = require('./agent');

const app = express();
app.use(express.json());

// ---- 1) Webhook verification (Meta calls this once when you save the config) ----
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified successfully.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---- 2) Incoming messages ----
app.post('/webhook', async (req, res) => {
  // Always ack immediately so Meta doesn't retry/timeout on us.
  res.sendStatus(200);

  try {
    const parsed = parseIncomingMessage(req.body);
    if (!parsed || !parsed.text) return; // e.g. a status update, ignore it

    const { from, text } = parsed;
    console.log(`Incoming from ${from}: ${text}`);

    const reply = await handleCustomerMessage(from, text);
    await sendTextMessage(from, reply);
    console.log(`Replied to ${from}: ${reply}`);
  } catch (err) {
    console.error('Error handling incoming webhook:', err.message);
  }
});

// ---- Health check ----
app.get('/', (req, res) => res.send('Egy France WhatsApp bot is running.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
