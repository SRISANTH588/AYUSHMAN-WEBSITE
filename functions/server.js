const express  = require("express");
const axios    = require("axios");
const admin    = require("firebase-admin");

const app = express();
app.use(express.json());

// ── Firebase Admin Init ───────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ayushman-physiofit-5b6ad'
});
const db = admin.firestore();

// ── Config (set these as Render Environment Variables) ────────────────────────
const VERIFY_TOKEN    = process.env.VERIFY_TOKEN    || "ayushman_physiofit_webhook";
const WHATSAPP_TOKEN  = process.env.WHATSAPP_TOKEN  || "EAAWHPvzPZCZBcBRcoU9eHAYyGCslQO3T0pAALHNQTseMVBZBHa3ADo2ob0nDpFFrqtMU7qNaiKCtNrT7tZA8ijnQX7tqKJR0PdCMBVbqsBLYtNOli0fSWTZBNUQ8fZCUgPutXipC8y11NugR637niEYqrp51EZAxG8yFaMBZBDD1ZAaqhWoZCxH59kIpQHJwtBpgZDZD";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "1102187382984050";

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Receive messages
app.post("/webhook", async (req, res) => {
  const body = req.body;

  try {
    const entry   = body.entry?.[0];
    const value   = entry?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (message) {
      const from    = message.from;
      const name    = contact?.profile?.name || "Patient";
      const msgBody = message.text?.body || "";
      const text    = msgBody.toLowerCase().trim();

      // ── Detect intent ──────────────────────────────────────────────────
      let intent = "general";
      if (text.includes("appointment") || text.includes("book") || text === "1")  intent = "book_appointment";
      else if (text.includes("home visit") || text.includes("home physio") || text === "4") intent = "home_visit";
      else if (text.includes("fitness") || text.includes("class") || text.includes("enroll")) intent = "fitness";
      else if (text.includes("hi") || text.includes("hello") || text.includes("hey") || text === "start") intent = "greeting";
      else if (text === "2") intent = "services";
      else if (text === "3") intent = "contact";

      // ── Save to Firebase ──────────────────────────────────────────────────
      await db.collection("whatsapp_messages").add({
        from, name, message: msgBody, intent,
        status: "unread",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // ── Save booking request if appointment intent ────────────────────────
      if (intent === "book_appointment") {
        await db.collection("whatsapp_bookings").add({
          phone: from, name, message: msgBody,
          status: "pending", source: "whatsapp",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // ── Auto reply ─────────────────────────────────────────────────────
      const replies = {
        greeting:        `Hello ${name}! 👋 Welcome to *Ayushman PhysioFIT* 🏥\n\nHow can we help you today?\n\n1️⃣ Book Appointment\n2️⃣ Our Services\n3️⃣ Contact & Location\n4️⃣ Home Physio Visit\n\nReply with a number or type your query.`,
        book_appointment:`✅ *Appointment Request Received!*\n\nDear ${name}, your request has been noted.\n\nOur team will confirm shortly.\n\nPlease share:\n📅 Preferred Date\n⏰ Preferred Time\n🩺 Your Condition\n\nBook online: https://ayushman-physiofit-5b6ad.web.app`,
        home_visit:      `🏠 *Home Physio Visit*\n\nWe provide home physiotherapy!\n\n📍 Available in Vijayawada & NTR District\n⏰ Mon–Sat: 9AM–9PM\n\nPlease share:\n- Your Name\n- Address\n- Condition\n- Preferred Date & Time`,
        services:        `🏥 *Our Services:*\n\n✅ Ortho & Sports Physiotherapy\n✅ Neurology Rehabilitation\n✅ Cardio Pulmonary\n✅ Women & Pediatric Physio\n✅ Post Surgery Recovery\n✅ General Fitness (Online Classes)\n✅ Home Physio Visit\n\nhttps://ayushman-physiofit-5b6ad.web.app`,
        contact:         `📍 *Ayushman PhysioFIT*\n\nD.No: 41-14-1/1, SowjiRaj Homes,\nKrishnalanka, Vijayawada – 520013\n\n📞 6302478412\n🕘 Mon–Sat: 9AM–9PM\n\n🌐 https://ayushman-physiofit-5b6ad.web.app`,
        fitness:         `🏋️ *Online PhysioFIT Classes*\n\n📅 3 Classes/week\n💰 ₹2,400/month\n🎥 Premium video access included\n\nEnroll: https://ayushman-physiofit-5b6ad.web.app/#online-classes`,
        general:         `Thank you for contacting *Ayushman PhysioFIT* 🏥\n\nOur team will get back to you shortly.\n\nReply with:\n1️⃣ Book Appointment\n2️⃣ Our Services\n3️⃣ Contact & Location\n4️⃣ Home Physio Visit`
      };

      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: from, type: "text", text: { body: replies[intent] || replies.general } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Webhook Error:", err.message);
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Ayushman PhysioFIT WhatsApp Bot is running! ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
