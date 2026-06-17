const express  = require("express");
const axios    = require("axios");
const admin    = require("firebase-admin");

const app = express();
app.use(express.json());

// ── Firebase Admin Init ──────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ayushman-physiofit-5b6ad'
});
const db = admin.firestore();

// ── Config ───────────────────────────────────────────────────────────────────
const VERIFY_TOKEN    = process.env.VERIFY_TOKEN    || "ayushman_physiofit_webhook";
const WHATSAPP_TOKEN  = process.env.WHATSAPP_TOKEN  || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";

// ── Session store (tracks booking steps per user) ────────────────────────────
const sessions = {};

// ── Send WhatsApp message helper ─────────────────────────────────────────────
async function sendMsg(to, body) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "text", text: { body } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
  );
}

// ── Webhook verification ──────────────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN)
    return res.status(200).send(challenge);
  res.sendStatus(403);
});

// ── Receive messages ──────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  try {
    const value   = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (message && message.type === "text") {
      const from    = message.from;
      const name    = contact?.profile?.name || "Patient";
      const msgBody = message.text?.body?.trim() || "";
      const text    = msgBody.toLowerCase();

      // Save every message to Firebase
      await db.collection("whatsapp_messages").add({
        from, name, message: msgBody, status: "unread",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get or create session
      if (!sessions[from]) sessions[from] = { step: "menu" };
      const session = sessions[from];

      // ── MAIN MENU ────────────────────────────────────────────────────────
      if (text === "menu" || text === "0" || text === "hi" || text === "hello" || text === "hey" || text === "start" || session.step === "menu" && !["1","2","3","4","5"].includes(text)) {
        sessions[from] = { step: "menu" };
        await sendMsg(from,
          "👋 Hello " + name + "! Welcome to *Ayushman PhysioFIT* 🏥\n" +
          "_We Keep You Moving..._\n\n" +
          "Please choose an option:\n\n" +
          "1️⃣ Book Appointment\n" +
          "2️⃣ Home Physio Visit\n" +
          "3️⃣ Our Services\n" +
          "4️⃣ Fitness Classes\n" +
          "5️⃣ Contact & Location\n\n" +
          "Reply with a number (1-5)"
        );

      // ── BOOK APPOINTMENT ─────────────────────────────────────────────────
      } else if (text === "1" && session.step === "menu") {
        sessions[from] = { step: "book_name" };
        await sendMsg(from, "📋 *Book Appointment*\n\nPlease enter your *Full Name*:");

      } else if (session.step === "book_name") {
        sessions[from] = { step: "book_phone", name: msgBody };
        await sendMsg(from, "📞 Please enter your *Phone Number*:");

      } else if (session.step === "book_phone") {
        sessions[from] = { ...session, step: "book_condition", phone: msgBody };
        await sendMsg(from, "🩺 What is your *Condition / Reason for visit*?\n\nExample: Knee Pain, Back Pain, Stroke Rehab");

      } else if (session.step === "book_condition") {
        sessions[from] = { ...session, step: "book_date", condition: msgBody };
        await sendMsg(from, "📅 Please enter your *Preferred Date*:\n\nExample: 20 June 2026");

      } else if (session.step === "book_date") {
        sessions[from] = { ...session, step: "book_time", date: msgBody };
        await sendMsg(from,
          "⏰ Please choose your *Preferred Time Slot*:\n\n" +
          "1️⃣ 9:00 AM – 10:00 AM\n" +
          "2️⃣ 10:00 AM – 11:00 AM\n" +
          "3️⃣ 11:00 AM – 12:00 PM\n" +
          "4️⃣ 12:00 PM – 1:00 PM\n" +
          "5️⃣ 2:00 PM – 3:00 PM\n" +
          "6️⃣ 3:00 PM – 4:00 PM\n" +
          "7️⃣ 4:00 PM – 5:00 PM\n" +
          "8️⃣ 5:00 PM – 6:00 PM\n\n" +
          "Reply with number (1-8)"
        );

      } else if (session.step === "book_time") {
        const slots = { "1":"9:00 AM","2":"10:00 AM","3":"11:00 AM","4":"12:00 PM","5":"2:00 PM","6":"3:00 PM","7":"4:00 PM","8":"5:00 PM" };
        sessions[from] = { ...session, step: "book_doctor", time: slots[msgBody] || msgBody };
        await sendMsg(from,
          "👨‍⚕️ Please choose your *Doctor*:\n\n" +
          "1️⃣ Dr. Durga Sowjanya (MPT Neuro)\n" +
          "2️⃣ Dr. D. Ramachandra (Physiotherapist)\n\n" +
          "Reply with 1 or 2"
        );

      } else if (session.step === "book_doctor") {
        const doctors = { "1":"Dr. Durga Sowjanya","2":"Dr. D. Ramachandra" };
        const s = { ...session, doctor: doctors[msgBody] || msgBody };
        const ref = await db.collection("appointments").add({
          name:      s.name,
          phone:     s.phone || from,
          condition: s.condition,
          date:      s.date,
          time:      s.time,
          doctor:    s.doctor,
          status:    "pending",
          source:    "whatsapp",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await db.collection("whatsapp_bookings").add({
          phone: from, name: s.name,
          condition: s.condition, date: s.date,
          time: s.time, doctor: s.doctor,
          appointmentId: ref.id,
          status: "pending", source: "whatsapp",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        sessions[from] = { step: "menu" };
        await sendMsg(from,
          "✅ *Booking Request Received!*\n\n" +
          "📋 *Details:*\n" +
          "👤 Name: " + s.name + "\n" +
          "📞 Phone: " + (s.phone || from) + "\n" +
          "🩺 Condition: " + s.condition + "\n" +
          "📅 Date: " + s.date + "\n" +
          "⏰ Time: " + s.time + "\n" +
          "👨‍⚕️ Doctor: " + s.doctor + "\n\n" +
          "⏳ Our team will confirm your appointment shortly!\n\n" +
          "🏥 *Ayushman PhysioFIT*\n" +
          "📞 6302478412\n\n" +
          "Reply *menu* to go back to main menu."
        );

      // ── HOME PHYSIO VISIT ────────────────────────────────────────────────
      } else if (text === "2" && session.step === "menu") {
        sessions[from] = { step: "hv_name" };
        await sendMsg(from, "🏠 *Home Physio Visit Booking*\n\nPlease enter your *Full Name*:");

      } else if (session.step === "hv_name") {
        sessions[from] = { step: "hv_phone", name: msgBody };
        await sendMsg(from, "📞 Please enter your *Phone Number*:");

      } else if (session.step === "hv_phone") {
        sessions[from] = { ...session, step: "hv_condition", phone: msgBody };
        await sendMsg(from, "🩺 What is your *Condition*?");

      } else if (session.step === "hv_condition") {
        sessions[from] = { ...session, step: "hv_address", condition: msgBody };
        await sendMsg(from, "📍 Please enter your *Full Address*:");

      } else if (session.step === "hv_address") {
        sessions[from] = { ...session, step: "hv_date", address: msgBody };
        await sendMsg(from, "📅 Please enter your *Preferred Date & Time*:\n\nExample: 20 June 2026, 10:00 AM");

      } else if (session.step === "hv_date") {
        const s = { ...session, datetime: msgBody };
        await db.collection("homevisits").add({
          name:      s.name,
          phone:     s.phone || from,
          condition: s.condition,
          address:   s.address,
          datetime:  s.datetime,
          status:    "pending",
          source:    "whatsapp",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        sessions[from] = { step: "menu" };
        await sendMsg(from,
          "✅ *Home Visit Request Received!*\n\n" +
          "👤 Name: " + s.name + "\n" +
          "🩺 Condition: " + s.condition + "\n" +
          "📍 Address: " + s.address + "\n" +
          "📅 Date & Time: " + s.datetime + "\n\n" +
          "Our team will contact you shortly to confirm!\n" +
          "📞 6302478412\n\n" +
          "Reply *menu* for main menu."
        );

      // ── SERVICES ─────────────────────────────────────────────────────────
      } else if (text === "3" && session.step === "menu") {
        await sendMsg(from,
          "🏥 *Our Services:*\n\n" +
          "✅ Ortho & Sports Physiotherapy\n" +
          "✅ Neurology Rehabilitation\n" +
          "✅ Cardio Pulmonary\n" +
          "✅ Women & Pediatric Physio\n" +
          "✅ Post Surgery Recovery\n" +
          "✅ General Fitness Classes\n" +
          "✅ Home Physio Visit\n\n" +
          "🌐 https://ayushman-physiofit-5b6ad.web.app\n\n" +
          "Reply *menu* to go back."
        );

      // ── FITNESS ──────────────────────────────────────────────────────────
      } else if (text === "4" && session.step === "menu") {
        await sendMsg(from,
          "🏋️ *Online PhysioFIT Classes*\n\n" +
          "📅 3 Classes/week (Mon, Wed, Fri)\n" +
          "💰 ₹2,400/month\n" +
          "🎥 Premium video access included\n\n" +
          "Enroll now:\n" +
          "🌐 https://ayushman-physiofit-5b6ad.web.app\n\n" +
          "Reply *menu* to go back."
        );

      // ── CONTACT ──────────────────────────────────────────────────────────
      } else if (text === "5" && session.step === "menu") {
        await sendMsg(from,
          "📍 *Ayushman PhysioFIT*\n" +
          "Rehabilitation Centre\n\n" +
          "D.No: 41-14-1/1, SowjiRaj Homes,\n" +
          "Krishnalanka, Vijayawada – 520013\n\n" +
          "📞 6302478412\n" +
          "🕘 Mon–Sat: 9:00 AM – 9:00 PM\n\n" +
          "🌐 https://ayushman-physiofit-5b6ad.web.app\n\n" +
          "Reply *menu* to go back."
        );

      // ── DEFAULT ──────────────────────────────────────────────────────────
      } else {
        await sendMsg(from,
          "🏥 *Ayushman PhysioFIT*\n\n" +
          "Sorry, I didn't understand that.\n\n" +
          "Reply *menu* to see options or call us:\n" +
          "📞 6302478412"
        );
      }
    }
  } catch (err) {
    console.error("Webhook Error:", err.message);
  }
  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Ayushman PhysioFIT WhatsApp Bot is running! ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
