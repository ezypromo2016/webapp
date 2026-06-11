const fs = require('fs');

const path = './server.ts';
let code = fs.readFileSync(path, 'utf8');

const eLoadEndpoint = `

  // ── E-LOADING SIMULATED ENDPOINT ───────────────────────────────────────
  app.post("/api/buy-load", async (req, res) => {
    const { phoneNumber, telcoNetwork, amountOrPromoCode, senderId, senderName, senderEmail } = req.body;
    console.log("[E-LOAD] Incoming request:", req.body);
    
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    // For promo codes we'll just extract numbers or assume a price.
    let numericAmount = parseFloat(amountOrPromoCode);
    if (isNaN(numericAmount)) {
       // Mock promo prices
       if (amountOrPromoCode === "GIGA99") numericAmount = 99;
       else if (amountOrPromoCode === "GO50") numericAmount = 50;
       else numericAmount = 100;
    }
    
    // Low wallet balance check simulation
    if (numericAmount > 5000) {
      return res.status(400).json({ error: "low_balance", message: "Merchant PayMongo Wallet balance is insufficient." });
    }

    // Invalid network / timeout check simulation
    // Let's pretend if network is DITO and amount is 123, it times out
    if (telcoNetwork === "DITO" && numericAmount === 123) {
      return res.status(504).json({ error: "network_timeout", message: "Telco validation timeout. Please try again." });
    }

    const marginPercentage = 0.05; // 5% margin
    const wholesaleCost = numericAmount * (1 - marginPercentage);
    const profit = numericAmount - wholesaleCost;

    // Simulate saving E-Load transaction
    if (senderId) {
      try {
        await addDoc(collection(db, "transactions"), {
          senderId,
          recipientId: "eload",
          amount: numericAmount,
          status: "completed",
          type: "e_load",
          createdAt: serverTimestamp(),
          metadata: {
            senderUsername: senderName || "User",
            senderEmail: senderEmail || "",
            telcoNetwork,
            phoneNumber,
            promoCode: isNaN(parseFloat(amountOrPromoCode)) ? amountOrPromoCode : null,
            wholesaleCost,
            profit
          }
        });
      } catch (e) {
        console.error("Failed to save E-Load transaction:", e);
      }
    }

    return res.status(200).json({ 
      status: "success", 
      message: \`Successfully loaded ₱\${numericAmount} to \${phoneNumber}.\`,
      referenceId: "LOAD-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      receipt: {
         phoneNumber,
         network: telcoNetwork,
         amount: numericAmount,
         wholesaleCost: wholesaleCost.toFixed(2),
         retailPrice: numericAmount.toFixed(2),
         margin: profit.toFixed(2)
      }
    });
  });
`;

// Insert it before app.get("/api/health" ...
code = code.replace('app.get("/api/health",', eLoadEndpoint + '\n\n  app.get("/api/health",');

fs.writeFileSync(path, code);
console.log("Added E-Load API endpoint");
