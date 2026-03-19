const fetch = require("node-fetch");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { amount, orderId } = req.body;

  if (!amount || !orderId) {
    return res.status(400).json({ message: "Amount and Order ID are required" });
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return res.status(500).json({ message: "Server Key not configured" });
  }

  const authString = Buffer.from(`${serverKey}:`).toString("base64");

  try {
    const response = await fetch("https://api.sandbox.midtrans.com/v2/charge", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify({
        payment_type: "qris",
        transaction_details: {
          order_id: orderId,
          gross_amount: parseInt(amount),
        },
        qris: {
          acquirer: "gpn",
        },
      }),
    });

    const data = await response.json();

    if (data.status_code !== "201") {
      return res.status(400).json({ 
        message: "Midtrans Error", 
        error: data.status_message 
      });
    }

    // Ambil QR URL dari actions
    const qrAction = data.actions.find(a => a.name === "generate-qr-code");

    return res.status(200).json({
      orderId: data.order_id,
      grossAmount: data.gross_amount,
      qrUrl: qrAction ? qrAction.url : null,
      transactionStatus: data.transaction_status,
    });

  } catch (error) {
    console.error("QRIS Generation Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
