const axios = require('axios');

const GRAPH_VERSION = 'v21.0';

function apiUrl() {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

async function sendTextMessage(to, body) {
  try {
    await axios.post(
      apiUrl(),
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('WhatsApp send error:', err.response?.data || err.message);
    throw err;
  }
}

// Extracts the useful bits out of the raw webhook payload.
// Returns null if this payload isn't an incoming user text message
// (e.g. it's a status update like "delivered"/"read").
function parseIncomingMessage(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return null;

  const from = message.from; // customer phone number
  const phoneNumberId = value.metadata?.phone_number_id;
  const text = message.text?.body || '';
  const contactName = value.contacts?.[0]?.profile?.name || '';

  return { from, phoneNumberId, text, contactName };
}

module.exports = { sendTextMessage, parseIncomingMessage };
