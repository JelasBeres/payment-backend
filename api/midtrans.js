const admin = require("firebase-admin");
const crypto = require("crypto");

// Ambil Service Account dari Environment Variable di Vercel
// Kamu harus mengcopy isi file JSON Service Account ke env variable FIREBASE_SERVICE_ACCOUNT
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const notification = req.body;
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const grossAmount = notification.gross_amount;
    const paymentType = notification.payment_type;
    const signatureKey = notification.signature_key;
    const statusCode = notification.status_code;

    // Verifikasi Signature (Security)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
      console.error("MIDTRANS_SERVER_KEY is not set in environment variables!");
      // Kita tetap lanjut jika dalam development, tapi idealnya return error
    }

    if (!signatureKey) {
      console.error("Missing signature_key in request!");
      return res.status(401).json({ message: "Signature Key is required" });
    }

    const hash = crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");

    if (hash !== signatureKey) {
      console.error(
        `Invalid Signature! Calculated: ${hash}, Received: ${signatureKey}`,
      );
      return res.status(401).json({ message: "Invalid Signature" });
    }

    console.log(`Midtrans Webhook: ${orderId} - ${transactionStatus}`);

    if (transactionStatus === "settlement") {
      const message = {
        data: {
          sender: paymentType.toUpperCase(),
          amount: grossAmount.split(".")[0],
          orderId: orderId,
        },
        topic: "payments",
        android: {
          priority: "high",
        },
      };

      await admin.messaging().send(message);
      console.log("FCM Sent via Vercel!");
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Vercel Webhook Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
