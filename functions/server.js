const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "ayushman_physiofit_webhook";
const WHATSAPP_TOKEN = "EAAWHPvzPZCZBcBRR03822GiWhVlxowd15UaAJNoBlj2WhR4GtfoHO6wz6CilehggZAghcUAw2YBWiD1oNWRZAu9jzRn4enDz1m2f76ExmDyGAeS4wZCSzJNN57eIGerbZB6PXAZCQJaGZAR1ZBdnfXSXVnkxXCGWpIMFAeHSqXRhRlx1CP3qlth7iLccF1JdfqdGh02WmWN6dgqMvC8VdU2IkJg7dcqBcBY7r8OSFsPlrDWemDaqZCpJWZBABGIhFqrIYUEIPjltICw6Ha68mgpXH4CJtkZD";
const PHONE_NUMBER_ID = "1102187382984050";

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
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase().trim();

      let replyText = "";

      if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
        replyText = "Hello! Welcome to Ayushman PhysioFIT 🏥\n\nHow can we help you?\n1. Book Appointment\n2. Our Services\n3. Contact Us";
      } else if (text.includes("appointment") || text.includes("book") || text === "1") {
        replyText = "To book an appointment, please share:\n- Your Name\n- Preferred date & time\n- Type of treatment needed\n\nOur team will confirm shortly! ✅";
      } else if (text.includes("service") || text === "2") {
        replyText = "We offer:\n✅ Ortho & Sports Physiotherapy\n✅ Neurology\n✅ Cardio Pulmonary\n✅ Women & Pediatric\n✅ General Fitness\n✅ Post Surgery Rehab";
      } else if (text.includes("contact") || text === "3") {
        replyText = "📍 Ayushman PhysioFIT\n🌐 Visit our website for location & timings\n📞 Our team will call you back shortly!";
      } else {
        replyText = "Thank you for contacting Ayushman PhysioFIT! 🏥\n\nReply with:\n1. Book Appointment\n2. Our Services\n3. Contact Us";
      }

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

  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Ayushman PhysioFIT WhatsApp Bot is running! ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
