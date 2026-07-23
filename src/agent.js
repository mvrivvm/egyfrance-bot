const OpenAI = require('openai');
const { appendCustomerRow } = require('./sheets');
const { sendTextMessage } = require('./whatsapp');

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

const conversations = new Map();
const MAX_HISTORY = 14;

const INTRO_MESSAGE_1 = 'أهلاً بك في مصنع Egy France مع حضرتك د/ علا.. هسألك كام سؤال بسيط عشان أقدر أساعدك بأفضل شكل';
const INTRO_MESSAGE_2 = 'اتشرف ب اسم حضرتك؟';

const PACKAGES_REFERENCE = `
حزمة "اجهاد حراري":
برنامج الاجهاد الحراري عبارة عن: كيلو فيتامين سي (جرعة وقت الفجر)، كيلو اليكتروفارم (جرعة من 9 ص)، نص لتر مينتومكس (بعدها بشوية)، كيلو ايجي برو (جرعة المغرب). نازل عليه عرض حاليًا المجموعة كاملة بـ 2650 ج 💚

حزمة "IB":
علاج الـ IB: نص كيلو ايجي مالتي باور، نص لتر مينتومكس، نص كيلو ايجي كوول. نازل عليه عرض حاليًا المجموعة كاملة بـ 2700 ج 💚

حزمة "جمبورو":
برنامج التعافي الفيروسي الخاص بالجمبورو عبارة عن: نص كيلو ايجي مالتي باور، نص كيلو ايجي كوول، كيلو اليكتروفارم. نازل عليه عرض حاليًا المجموعة كاملة بـ 3150 ج 💚
`;

const SYSTEM_PROMPT = `انت "د/ علا"، مندوب مبيعات في مصنع Egy France لمنتجات صحة الدواجن، بتتكلم مع عميل على واتساب.
اتكلم باللهجة المصرية العامية، أسلوب ودود ومحترف، وردودك قصيرة (متطولش). اسأل سؤال واحد بس في كل رسالة.

ملحوظة مهمة: أول رسالتين ترحيب (السلام والسؤال عن الاسم) اتبعتوا للعميل خلاص قبل ما تتدخل انت، فمتكررهمش. إنت بتكمل المحادثة من بعدهم.

الترتيب اللي لازم تتبعه بالظبط:

1. لو العميل لسه ما قالش اسمه (رد بحاجة تانية غير اسمه)، وضحله بأسلوب لبق إنك محتاج اسمه الأول عشان تقدر تساعده صح، واسأله تاني.

2. **متسألش عن رقم الموبايل خالص** — رقم العميل معروف تلقائيًا من رقم الواتساب اللي بيكلمك بيه.

3. بعد ما تاخد الاسم، اسأله: "حضرتك مربي ولا مكتب؟"

4. لو قال "مربي": اسأله "بتربي في عدد كام يا فندم؟"
   لو قال "مكتب": اسأله "مكتب حضرتك فين يا فندم؟"

5. بعد كده اسأله: "حضرتك بخصوص ايه يا فندم؟" (يعني عايز يستفسر عن ايه بالظبط).

6. لو ذكر واحدة من الحالات دي (اجهاد حراري / IB / جمبورو)، رد بنفس تفاصيل الباقة والسعر **حرفيًا زي ما هي تحت من غير أي تغيير في الأرقام أو المكونات أو السعر**:
${PACKAGES_REFERENCE}
   لو ذكر حالة تانية مش من التلاتة دي، اسأله يوضح أكتر أو قوله هتتواصل معاه فريق المبيعات بالتفاصيل.

7. بعد ما تقدم الباقة المناسبة، استخدم أداة log_customer فورًا عشان تسجل بيانات العميل (الاسم، نوع النشاط: مربي/مكتب، التفصيلة: العدد أو مكان المكتب، الاستفسار، اسم الباقة والسعر)، وبعدها أكد للعميل إن طلبه اتسجل وهيتواصل معاه فريق المبيعات.`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'log_customer',
      description: 'يسجل بيانات العميل والباقة المرشحة له في شيت جوجل، لما تكتمل البيانات المطلوبة.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'اسم العميل' },
          farm_type: { type: 'string', description: 'مربي أو مكتب' },
          farm_detail: { type: 'string', description: 'عدد الطيور لو مربي، أو موقع المكتب لو مكتب' },
          inquiry: { type: 'string', description: 'موضوع الاستفسار (اجهاد حراري / IB / جمبورو / غيره)' },
          product: { type: 'string', description: 'اسم الباقة المرشحة والسعر' },
          notes: { type: 'string', description: 'أي ملاحظات إضافية' }
        },
        required: ['customer_name', 'farm_type', 'farm_detail', 'inquiry', 'product']
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

async function completeWithRetry(model, messages) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await openai.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto'
      });
    } catch (err) {
      console.error(`Tool-calling attempt ${attempt} failed:`, err.message);
    }
  }

  console.error('Falling back to a plain reply without tools for this turn.');
  return openai.chat.completions.create({ model, messages });
}

async function handleCustomerMessage(phone, incomingText) {
  const isFirstContact = getHistory(phone).length === 0;

  if (isFirstContact) {
    await sendTextMessage(phone, INTRO_MESSAGE_1);
    await sendTextMessage(phone, INTRO_MESSAGE_2);
    pushHistory(phone, { role: 'assistant', content: `${INTRO_MESSAGE_1}\n${INTRO_MESSAGE_2}` });
    return;
  }

  pushHistory(phone, { role: 'user', content: incomingText });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getHistory(phone)
  ];

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  let completion = await completeWithRetry(model, messages);
  let responseMessage = completion.choices[0].message;

  if (responseMessage.tool_calls?.length) {
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      if (toolCall.function.name === 'log_customer') {
        const args = JSON.parse(toolCall.function.arguments);
        try {
          await appendCustomerRow({
            name: args.customer_name,
            phone,
            product: `${args.product} | ${args.farm_type}: ${args.farm_detail} | استفسار: ${args.inquiry}`,
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

    completion = await openai.chat.completions.create({ model, messages });
    responseMessage = completion.choices[0].message;
  }

  const replyText = responseMessage.content || 'تمام، ممكن توضحلي أكتر؟';
  pushHistory(phone, { role: 'assistant', content: replyText });

  await sendTextMessage(phone, replyText);
}

module.exports = { handleCustomerMessage };
