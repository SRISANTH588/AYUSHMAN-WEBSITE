const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

const VERIFY_TOKEN   = "ayushman_physiofit_2026";
const WHATSAPP_TOKEN = "EAAWHPvzPZCZBcBRuKunu9F0v7Cqpik4QPOpftH48ZB0mc6UnEPsOf6PqgsMKDuQV5sBZB53QoJxdTSRPyjTcFGCYaiTeD9iFcw9PU4ZANBjTBqe6ZCCm8j9XqImyj24CIFPZCGFFGZBwLoAyVVK5MZAU2FKHfHyukGcwcnxQLeeU4ZCv1kM7Nsp0V6iEft59eMTihHA4AghgXhOI05elgrHQZBUXZC7jFFJns0XP65OXX8xYSfn0pHmft5B7iKLSrWi8ukY8VVMyYRxMYmZCZBtRijdHDs";
const PHONE_NUMBER_ID = "1104497396082962";

// ── WEBHOOK ───────────────────────────────────────────────────────────────────
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {

  // Verification handshake
  if (req.method === "GET") {
    const mode      = req.query["hub.mode"];
    const token     = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN)
      return res.status(200).send(challenge);
    return res.sendStatus(403);
  }

  if (req.method === "POST") {
    try {
      const entry   = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;
      const message = value?.messages?.[0];
      const contact = value?.contacts?.[0];

      if (message) {
        const from    = message.from;
        const name    = contact?.profile?.name || "Unknown";
        const msgBody = message.text?.body || "";
        const text    = msgBody.toLowerCase().trim();
        const ts      = new Date().toISOString();

        // ── Detect intent ────────────────────────────────────────────────────
        let intent = "general";
        let bookingData = null;

        if (text.includes("appointment") || text.includes("book") || text.includes("booking")) {
          intent = "appointment";
        } else if (text.includes("home visit") || text.includes("home physio")) {
          intent = "home_visit";
        } else if (text.includes("class") || text.includes("fitness") || text.includes("enroll")) {
          intent = "fitness";
        } else if (text.includes("hi") || text.includes("hello") || text.includes("hey") || text.includes("start")) {
          intent = "greeting";
        } else if (text === "1") {
          intent = "book_appointment";
        } else if (text === "2") {
          intent = "services";
        } else if (text === "3") {
          intent = "contact";
        } else if (text === "4") {
          intent = "home_visit_info";
        }

        // ── Save to Firestore ─────────────────────────────────────────────────
        await db.collection("whatsapp_messages").add({
          from,
          name,
          message: msgBody,
          intent,
          status: "unread",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: ts
        });

        // ── If booking intent → create pending booking ────────────────────────
        if (intent === "appointment" || intent === "book_appointment") {
          await db.collection("whatsapp_bookings").add({
            phone: from,
            name,
            message: msgBody,
            status: "pending",
            source: "whatsapp",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // ── Auto reply ────────────────────────────────────────────────────────
        let reply = "";

        if (intent === "greeting") {
          reply = `Hello ${name}! 👋 Welcome to *Ayushman PhysioFIT* 🏥\n\nHow can we help you today?\n\n1️⃣ Book Appointment\n2️⃣ Our Services\n3️⃣ Contact & Location\n4️⃣ Home Physio Visit\n\nReply with a number or type your query.`;
        } else if (intent === "appointment" || intent === "book_appointment") {
          reply = `✅ *Appointment Request Received!*\n\nDear ${name}, your request has been noted.\n\nOur team will confirm your appointment shortly.\n\nPlease share:\n📅 Preferred Date\n⏰ Preferred Time\n🩺 Your Condition\n\nOr book directly: https://ayushman-physiofit-218ae.web.app`;
        } else if (intent === "home_visit" || intent === "home_visit_info") {
          reply = `🏠 *Home Physio Visit*\n\nWe provide home physiotherapy services!\n\n📍 Available in Vijayawada & NTR District\n⏰ Mon–Sat: 9AM–9PM\n\nTo book a home visit, please share:\n- Your Name\n- Address\n- Condition\n- Preferred Date & Time\n\nOr visit: https://ayushman-physiofit-218ae.web.app/#online-classes`;
        } else if (intent === "services") {
          reply = `🏥 *Our Services:*\n\n✅ Ortho & Sports Physiotherapy\n✅ Neurology Rehabilitation\n✅ Cardio Pulmonary\n✅ Women & Pediatric Physio\n✅ Post Surgery Recovery\n✅ General Fitness (Online Classes)\n✅ Home Physio Visit\n\nFor more: https://ayushman-physiofit-218ae.web.app/#services`;
        } else if (intent === "contact") {
          reply = `📍 *Ayushman PhysioFIT*\n\nD. No: 41-14-1/1, SowjiRaj Homes,\nKrishnalanka, Vijayawada – 520013\n\n📞 6302478412\n🕘 Mon–Sat: 9:00 AM – 9:00 PM\n\n🌐 https://ayushman-physiofit-218ae.web.app`;
        } else if (intent === "fitness") {
          reply = `🏋️ *Online PhysioFIT Classes*\n\n📅 3 Classes/week (Mon, Wed, Fri)\n💰 ₹2,400/month\n🎥 Premium video access included\n\nEnroll now: https://ayushman-physiofit-218ae.web.app/#online-classes`;
        } else {
          reply = `Thank you for contacting *Ayushman PhysioFIT* 🏥\n\nOur team will get back to you shortly.\n\nReply with:\n1️⃣ Book Appointment\n2️⃣ Our Services\n3️⃣ Contact & Location\n4️⃣ Home Physio Visit`;
        }

        // ── Send reply via WhatsApp API ────────────────────────────────────────
        await axios.post(
          `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: reply }
          },
          {
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
      }
    } catch (err) {
      console.error("WhatsApp Webhook Error:", err.message);
    }

    return res.sendStatus(200);
  }
});
