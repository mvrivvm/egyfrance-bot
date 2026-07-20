const OpenAI = require('openai');
const { appendCustomerRow } = require('./sheets');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple in-memory conversation store, keyed by customer phone number.
// Note: resets if the server restarts. Good enough for an MVP;
// swap for a database/file store later if you need durability.
const conversations = new Map();
const MAX_HISTORY = 12; // keep last N messages per customer

const SYSTEM_PROMPT = `انت مساعد مبيعات ذكي لمصنع "إيجي فرانس" لمنتجات صحة الدواجن.
اتكلم باللهجة المصرية العامية بشكل ودود واحترافي، وردودك قصيرة ومباشرة (متطولش).
اسأل سؤال واحد بس في كل مرة.

هدفك بالترتيب:
1. اتعرفي على اسم العميل.
2. اعرفي رقم الموبايل بتاعه (لو مش واضح من الرقم اللي بيكلمك بيه، اسأليه يأكده).
3. افهمي نوع المزرعة أو المشكلة اللي بيواجهها في الدواجن.
4. رشحيله باقة منتج مناسبة من منتجات صحة الدواجن حسب احتياجه.
5. لما تجمعي البيانات دي كلها (اسم + رقم + المنتج المرشح)، استخدمي أداة log_customer عشان تسجلي الطلب فورًا، وبعدها أكدي للعميل إن طلبه اتسجل وهيتم التواصل معاه.`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'log_customer',
      description: 'يسجل بيانات العميل والمنتج المرشح له في شيت جوجل، لما تكتمل البيانات المطلوبة.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'اسم العميل الكامل' },
          phone: { type: 'string', description: 'رقم موبايل العميل' },
          product: { type: 'string', description: 'باقة المنتج اللي اترشحت للعميل' },
          notes: { type: 'string', description: 'أي ملاحظات إضافية عن حالة العميل أو مزرعته' }
        },
        required: ['customer_name', 'phone', 'product']
      }
    }
  }
];

function getHistory(phone) {
  if (!conversations.has(phone)) {
    conversations.set(phone, []);
  }
  return conversations.get(phone);
}

function pushHistory(phone, message) {
  const history = getHistory(phone);
  history.push(message);
  while (history.length > MAX_HISTORY) history.shift();
}

// Runs one turn of the agent for a given customer phone number + incoming text.
// Returns the text reply to send back over WhatsApp.
async function handleCustomerMessage(phone, incomingText) {
  pushHistory(phone, { role: 'user', content: incomingText });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getHistory(phone)
  ];

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  let completion = await openai.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: 'auto'
  });

  let responseMessage = completion.choices[0].message;

  // If the model wants to call the logging tool, execute it, then ask
  // the model to produce the final reply given the tool's result.
  if (responseMessage.tool_calls?.length) {
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      if (toolCall.function.name === 'log_customer') {
        const args = JSON.parse(toolCall.function.arguments);
        try {
          await appendCustomerRow({
            name: args.customer_name,
            phone: args.phone,
            product: args.product,
            notes: args.notes || ''
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'تم تسجيل بيانات العميل بنجاح في الشيت.'
          });
        } catch (err) {
          console.error('Sheets append failed:', err.message);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'حصل خطأ أثناء تسجيل البيانات، حاول تاني أو أبلغ العميل إننا هنتواصل معاه يدويًا.'
          });
        }
      }
    }

    completion = await openai.chat.completions.create({
      model,
      messages
    });
    responseMessage = completion.choices[0].message;
  }

  const replyText = responseMessage.content || 'تمام، هل ممكن توضحلي أكتر؟';
  pushHistory(phone, { role: 'assistant', content: replyText });

  return replyText;
}

module.exports = { handleCustomerMessage };
