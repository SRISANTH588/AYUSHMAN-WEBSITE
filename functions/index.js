const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

const VERIFY_TOKEN = "ayushman_physiofit_webhook";
const WHATSAPP_TOKEN = "EAAWHPvzPZCZBcBRR03822GiWhVlxowd15UaAJNoBlj2WhR4GtfoHO6wz6CilehggZAghcUAw2YBWiD1oNWRZAu9jzRn4enDz1m2f76ExmDyGAeS4wZCSzJNN57eIGerbZB6PXAZCQJaGZAR1ZBdnfXSXVnkxXCGWpIMFAeHSqXRhRlx1CP3qlth7iLccF1JdfqdGh02WmWN6dgqMvC8VdU2IkJg7dcqBcBY7r8OSFsPlrDWemDaqZCpJWZBABGIhFqrIYUEIPjltICw6Ha68mgpXH4CJtkZD";
const PHONE_NUMBER_ID = "1102187382984050";

// Webhook verification
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  if (req.method === "POST") {
    const body = req.body;

    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const message = changes?.value?.messages?.[0];

      if (message) {
        const from = message.from;
        const text = message.text?.body?.toLowerCase().trim();

        // Save message to Firestore
        await db.collection("whatsapp_messages").add({
          from,
          message: message.text?.body,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Auto reply logic
        let replyText = "";

        if (text.includes("appointment") || text.includes("book")) {
          replyText = "Hello! 👋 To book an appointment at Ayushman PhysioFIT, please visit our website or call us. Our team will assist you shortly!";
        } else if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
          replyText = "Hello! Welcome to Ayushman PhysioFIT 🏥\n\nHow can we help you today?\n1. Book Appointment\n2. Services Info\n3. Contact Us";
        } else if (text === "1") {
          replyText = "To book an appointment, please share your:\n- Name\n- Preferred date & time\n- Type of treatment needed";
        } else if (text === "2") {
          replyText = "We offer:\n✅ Ortho & Sports Physiotherapy\n✅ Neurology\n✅ Cardio Pulmonary\n✅ Women & Pediatric\n✅ General Fitness\n✅ Post Surgery Rehab";
        } else if (text === "3") {
          replyText = "📍 Visit us at Ayushman PhysioFIT\n📞 Contact our front desk for more info\n🌐 Check our website for details";
        } else {
          replyText = "Thank you for contacting Ayushman PhysioFIT! 🏥\nOur team will get back to you shortly.\n\nReply with:\n1. Book Appointment\n2. Services Info\n3. Contact Us";
        }

        // Send reply
        await axios.post(
          `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: replyText }
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
      console.error("Error:", err.message);
    }

    return res.sendStatus(200);
  }
});
