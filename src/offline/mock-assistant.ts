// A rule-based stand-in for the real model, so the pipeline runs with no API access.
// It is deliberately simple (keyword matching), which means it makes realistic
// mistakes: missed paraphrases, wrong topic picks, no understanding of tricks.
// That is useful: the eval should catch those mistakes.
import type { AssistantOutput } from "../types.js";

const HANDOFF =
  "I'm sorry to hear that. I'm passing this to a colleague who can help: call 0800 555 0199 " +
  "(Mon–Fri 8:00–18:00, Sat 9:00–14:00) or use \"Help\" → \"Talk to a person\" in the SunPeak app.";

const SAFETY_REPLY =
  "Please leave the area and call the emergency services first if there is any danger. " +
  "Do not touch the equipment. A colleague will contact you: you can also call 0800 555 0199.";

// Checked first: anything here always goes to a human.
const SAFETY_WORDS = ["smoke", "spark", "burning", "fire", "water in", "damaged cable", "shock"];
const ESCALATION_WORDS = ["complain", "complaint", "lawyer", "legal", "sue", "refund", "unacceptable", "angry"];

// Each topic: trigger keywords and an answer written from the knowledge base.
const TOPICS: Array<{ keywords: string[]; reply: string }> = [
  {
    keywords: ["how long", "timeline", "weeks", "when will", "installation take"],
    reply: "From signed contract to a working system usually takes 8–12 weeks. Installation day itself takes 1–2 days.",
  },
  {
    keywords: ["site survey", "survey"],
    reply: "A technician visits in weeks 1–2 to measure the roof and check your electrical panel. It takes about 2 hours.",
  },
  {
    keywords: ["be home", "need to be there", "access"],
    reply: "You don't need to be home on installation day, but someone must give access to the electrical panel.",
  },
  {
    keywords: ["pay", "payment", "deposit", "monthly", "financ", "credit card", "cash"],
    reply: "You can pay in full (20% deposit, 80% on installation day) or spread the cost over 60, 120 or 180 months, subject to a credit check. We accept bank transfer and direct debit only.",
  },
  {
    keywords: ["invoice", "bill"],
    reply: "Invoices are emailed to you and are also in the SunPeak app under \"Documents\".",
  },
  {
    keywords: ["cancel"],
    reply: "You can cancel free of charge within 14 days of signing. After that, cancellation fees depend on project progress and are listed in your contract.",
  },
  {
    keywords: ["clean", "maintenance", "inspection", "snow"],
    reply: "Panels need very little maintenance; rain usually keeps them clean and snow melts on its own. We recommend a professional inspection every 2 years, bookable in the SunPeak app.",
  },
  {
    keywords: ["offline", "not working", "no power", "app shows"],
    reply: "If the app shows a red \"System offline\" alert for more than 24 hours, please contact support on 0800 555 0199 so we can check it.",
  },
  {
    keywords: ["warranty", "guarantee"],
    reply: "Panels have a 25-year warranty, inverters and batteries 10 years, and installation work 5 years. Storm, fire or accident damage isn't covered; that's usually home insurance.",
  },
  {
    keywords: ["opening hours", "open", "phone number", "contact", "call you"],
    reply: "Phone and chat: Mon–Fri 8:00–18:00, Sat 9:00–14:00, closed Sundays and public holidays. Call 0800 555 0199 or email help@sunpeak.example.",
  },
];

const includesAny = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function mockAnswer(message: string): AssistantOutput {
  const text = message.toLowerCase();

  if (includesAny(text, SAFETY_WORDS)) return { reply: SAFETY_REPLY, escalate: true };
  if (includesAny(text, ESCALATION_WORDS)) return { reply: HANDOFF, escalate: true };

  const topic = TOPICS.find((t) => includesAny(text, t.keywords));
  if (topic) return { reply: topic.reply, escalate: false };

  // Unknown question: don't guess, hand over.
  return {
    reply: "I'm not sure about that one, so I'll pass you to a colleague. You can reach us on 0800 555 0199.",
    escalate: true,
  };
}
