const express  = require("express");
const axios    = require("axios");
const admin    = require("firebase-admin");

const app = express();
app.use(express.json());

// ── Firebase Admin Init ──────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "ayushman-physiofit-5b6ad"
});
const db = admin.firestore();

// ── Config ───────────────────────────────────────────────────────────────────
const VERIFY_TOKEN    = process.env.VERIFY_TOKEN    || "ayushman_physiofit_webhook";
const WHATSAPP_TOKEN  = process.env.WHATSAPP_TOKEN  || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";

// ── Session helpers (Firestore-backed, survives restarts) ────────────────────
async function getSession(from) {
  const doc = await db.collection("bot_sessions").doc(from).get();
  return doc.exists ? doc.data() : { step: "menu" };
}
async function setSession(from, data) {
  await db.collection("bot_sessions").doc(from).set(data);
}

// ── Send WhatsApp message ─────────────────────────────────────────────────────
async function sendMsg(to, body) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to, type: "text", text: { body } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log("✅ Sent to", to);
  } catch (err) {
    console.error("❌ sendMsg failed:", JSON.stringify(err.response?.data) || err.message);
  }
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
  res.sendStatus(200); // always respond fast to Meta

  try {
    const value   = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message || message.type !== "text") return;

    const from    = message.from;
    const name    = contact?.profile?.name || "Patient";
    const msgBody = message.text?.body?.trim() || "";
    const text    = msgBody.toLowerCase();

    // Save message to Firestore
    await db.collection("whatsapp_messages").add({
      from, name, message: msgBody, status: "unread",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    const session = await getSession(from);
    const step    = session.step;

    const isGreeting = ["hi", "hello", "hey", "start", "menu", "0"].includes(text);

    // ── MAIN MENU ─────────────────────────────────────────────────────────────
    if (isGreeting || step === "menu") {
      await setSession(from, { step: "menu" });
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
      if (step === "menu" && !isGreeting && !["1","2","3","4","5"].includes(text)) return;
    }

    // ── HANDLE MENU CHOICES ───────────────────────────────────────────────────
    if (step === "menu") {
      if (text === "1") {
        await setSession(from, { step: "book_name" });
        await sendMsg(from, "📋 *Book Appointment*\n\nPlease enter your *Full Name*:");

      } else if (text === "2") {
        await setSession(from, { step: "hv_name" });
        await sendMsg(from, "🏠 *Home Physio Visit Booking*\n\nPlease enter your *Full Name*:");

      } else if (text === "3") {
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

      } else if (text === "4") {
        await sendMsg(from,
          "🏋️ *Online PhysioFIT Classes*\n\n" +
          "📅 3 Classes/week (Mon, Wed, Fri)\n" +
          "💰 ₹2,400/month\n" +
          "🎥 Premium video access included\n\n" +
          "Enroll now:\n" +
          "🌐 https://ayushman-physiofit-5b6ad.web.app\n\n" +
          "Reply *menu* to go back."
        );

      } else if (text === "5") {
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
      }
      return;
    }

    // ── BOOK APPOINTMENT FLOW ─────────────────────────────────────────────────
    if (step === "book_name") {
      await setSession(from, { step: "book_phone", name: msgBody });
      await sendMsg(from, "📞 Please enter your *Phone Number*:");

    } else if (step === "book_phone") {
      await setSession(from, { ...session, step: "book_condition", phone: msgBody });
      await sendMsg(from, "🩺 What is your *Condition / Reason for visit*?\n\nExample: Knee Pain, Back Pain, Stroke Rehab");

    } else if (step === "book_condition") {
      await setSession(from, { ...session, step: "book_date", condition: msgBody });
      await sendMsg(from, "📅 Please enter your *Preferred Date*:\n\nExample: 20 June 2026");

    } else if (step === "book_date") {
      await setSession(from, { ...session, step: "book_time", date: msgBody });
      await sendMsg(from,
        "⏰ Please choose your *Preferred Time Slot*:\n\n" +
        "1️⃣ 9:00 AM\n2️⃣ 10:00 AM\n3️⃣ 11:00 AM\n4️⃣ 12:00 PM\n" +
        "5️⃣ 2:00 PM\n6️⃣ 3:00 PM\n7️⃣ 4:00 PM\n8️⃣ 5:00 PM\n\n" +
        "Reply with number (1-8)"
      );

    } else if (step === "book_time") {
      const slots = { "1":"9:00 AM","2":"10:00 AM","3":"11:00 AM","4":"12:00 PM","5":"2:00 PM","6":"3:00 PM","7":"4:00 PM","8":"5:00 PM" };
      const time = slots[text] || msgBody;
      await setSession(from, { ...session, step: "book_doctor", time });
      await sendMsg(from,
        "👨‍⚕️ Please choose your *Doctor*:\n\n" +
        "1️⃣ Dr. Durga Sowjanya (MPT Neuro)\n" +
        "2️⃣ Dr. D. Ramachandra (Physiotherapist)\n\n" +
        "Reply with 1 or 2"
      );

    } else if (step === "book_doctor") {
      const doctors = { "1":"Dr. Durga Sowjanya","2":"Dr. D. Ramachandra" };
      const s = { ...session, doctor: doctors[text] || msgBody };
      const ref = await db.collection("appointments").add({
        name: s.name, phone: s.phone || from,
        condition: s.condition, date: s.date, time: s.time, doctor: s.doctor,
        status: "pending", source: "whatsapp",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await setSession(from, { step: "menu" });
      await sendMsg(from,
        "✅ *Booking Request Received!*\n\n" +
        "👤 Name: " + s.name + "\n" +
        "📞 Phone: " + (s.phone || from) + "\n" +
        "🩺 Condition: " + s.condition + "\n" +
        "📅 Date: " + s.date + "\n" +
        "⏰ Time: " + s.time + "\n" +
        "👨‍⚕️ Doctor: " + s.doctor + "\n\n" +
        "⏳ Our team will confirm your appointment shortly!\n\n" +
        "🏥 *Ayushman PhysioFIT* · 📞 6302478412\n\n" +
        "Reply *menu* to go back to main menu."
      );

    // ── HOME VISIT FLOW ───────────────────────────────────────────────────────
    } else if (step === "hv_name") {
      await setSession(from, { step: "hv_phone", name: msgBody });
      await sendMsg(from, "📞 Please enter your *Phone Number*:");

    } else if (step === "hv_phone") {
      await setSession(from, { ...session, step: "hv_condition", phone: msgBody });
      await sendMsg(from, "🩺 What is your *Condition*?");

    } else if (step === "hv_condition") {
      await setSession(from, { ...session, step: "hv_address", condition: msgBody });
      await sendMsg(from, "📍 Please enter your *Full Address*:\n\nInclude house no, street, area, city");

    } else if (step === "hv_address") {
      await setSession(from, { ...session, step: "hv_date", address: msgBody });
      await sendMsg(from, "📅 Please enter your *Preferred Date & Time*:\n\nExample: 20 June 2026, 10:00 AM");

    } else if (step === "hv_date") {
      const s = { ...session, datetime: msgBody };
      await db.collection("homevisits").add({
        name: s.name, phone: s.phone || from,
        condition: s.condition, address: s.address, datetime: s.datetime,
        status: "pending", source: "whatsapp",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await setSession(from, { step: "menu" });
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

    // ── DEFAULT ───────────────────────────────────────────────────────────────
    } else {
      await setSession(from, { step: "menu" });
      await sendMsg(from,
        "🏥 *Ayushman PhysioFIT*\n\n" +
        "Sorry, I didn't understand that.\n\n" +
        "Reply *menu* to see options or call us:\n📞 6302478412"
      );
    }

  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send(
  `Ayushman PhysioFIT WhatsApp Bot ✅<br>` +
  `PHONE_NUMBER_ID: ${PHONE_NUMBER_ID ? "✅ set" : "❌ MISSING"}<br>` +
  `WHATSAPP_TOKEN: ${WHATSAPP_TOKEN ? "✅ set" : "❌ MISSING"}`
));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
