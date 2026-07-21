const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

function toWhatsappAddress(rawNumber) {
  if (!rawNumber) return rawNumber;
  return rawNumber.startsWith('whatsapp:') ? rawNumber : `whatsapp:${rawNumber}`;
}

async function sendTextMessage(to, body) {
  try {
    await client.messages.create({
      from: toWhatsappAddress(process.env.TWILIO_WHATSAPP_NUMBER),
      to: toWhatsappAddress(to),
      body
    });
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    throw err;
  }
}

function parseIncomingMessage(body) {
  if (!body?.From) return null;

  const from = body.From.replace('whatsapp:', '');
  const text = body.Body || '';
  const contactName = body.ProfileName || '';

  return { from, text, contactName };
}

module.exports = { sendTextMessage, parseIncomingMessage };
