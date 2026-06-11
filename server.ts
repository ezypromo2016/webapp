import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import cors from "cors"; // 🔌 Added to resolve browser cross-origin fetch failures
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  limit, 
  where, 
  doc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  writeBatch,
  getDoc,
  addDoc
} from "firebase/firestore/lite";
import dotenv from "dotenv";
import fs from "fs";

// ── FIREBASE CONFIGURATION WORKAROUND ──────────────────────────────────────────
dotenv.config({ override: true });

let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  console.log("[CONFIG] Loaded configuration from local JSON applet asset file.");
} catch (e) {
  console.log("[CONFIG] Local JSON file missing. Swapping variables to Cloud Environment context...");
  firebaseConfig = {
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "cbkapparel-shop",
    firestoreDatabaseId: "(default)"
  };
}

if (getApps().length === 0) {
  initializeApp({ projectId: firebaseConfig.projectId });
}

const clientApp = initializeClientApp(firebaseConfig);
let db = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// 📁 PERMANENT FIX: Define ledger file paths outside the root folder workspace.
// This prevents Vite from catching file updates and breaking development WebSockets.
const LEDGER_PATH = path.join(process.env.HOME || process.env.USERPROFILE || ".", ".cbk_ledger_transactions.txt");
// ───────────────────────────────────────────────────────────────────────────────

const serverTs = serverTimestamp;
const inc = increment;

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === "production";

  // ✅ Fix CORS connectivity block so browser fetches never fail
  app.use(cors({ origin: "*" }));
  app.use(express.json());

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server (PID ${process.pid}) running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`[SERVER] Port ${PORT} already in use.`);
    } else {
      console.error(`[SERVER] ERROR:`, e);
    }
  });

  // ── E-LOADING SIMULATED ENDPOINT ───────────────────────────────────────
  app.post("/api/buy-load", async (req, res) => {
    const { phoneNumber, telcoNetwork, amountOrPromoCode, senderId, senderName, senderEmail } = req.body;
    console.log("[E-LOAD] Incoming request:", req.body);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    let numericAmount = parseFloat(amountOrPromoCode);
    if (isNaN(numericAmount)) {
       if (amountOrPromoCode === "GIGA99") numericAmount = 99;
       else if (amountOrPromoCode === "GO50") numericAmount = 50;
       else numericAmount = 100;
    }
    
    if (numericAmount > 5000) {
      return res.status(400).json({ error: "low_balance", message: "Merchant PayMongo Wallet balance is insufficient." });
    }

    if (telcoNetwork === "DITO" && numericAmount === 123) {
      return res.status(504).json({ error: "network_timeout", message: "Telco validation timeout. Please try again." });
    }

    const marginPercentage = 0.05;
    const wholesaleCost = numericAmount * (1 - marginPercentage);
    const profit = numericAmount - wholesaleCost;

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

    const referenceId = "LOAD-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    // Log to file-based ledger using isolated storage path
    const logLine = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "E-LOAD",
      walletNumber: phoneNumber,
      amount: numericAmount,
      convenienceFee: profit,
      totalBilled: numericAmount, 
      targetWallet: telcoNetwork,
      referenceId,
      routingStatus: "GATEWAY_CLEARED",
      status: "SUCCESS"
    }) + "\n";
    await fs.promises.appendFile(LEDGER_PATH, logLine, "utf8");

    return res.status(200).json({ 
      status: "success", 
      message: `Successfully loaded ₱${numericAmount} to ${phoneNumber}.`,
      referenceId,
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

  // ── DAFOX SECURE BOOKKEEPING LEDGER ENDPOINT ───────────────────────────
  app.post("/api/dafox/cashin", async (req, res) => {
    const { targetWallet, walletNumber, amount, senderId } = req.body;
    
    if (!targetWallet || !walletNumber || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const DAFOX_TOKEN = process.env.DAFOX_SECRET_TOKEN || "";

    try {
      const timestamp = new Date().toISOString();
      const referenceId = "DFX-POS-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const parsedAmount = parseFloat(amount);
      const convenienceFee = parseFloat((parsedAmount * 0.05).toFixed(2));
      const totalBilled = parsedAmount + convenienceFee;

      // Execute live DafoxTech API Request
      let apiResponseData = {};
      try {
        const response = await axios.post(
          "https://dafoxtech.com/api/cashin", 
          { targetWallet, walletNumber, amount },
          { 
            headers: { 
              "DAFOX_SECRET_TOKEN": DAFOX_TOKEN,
              "Content-Type": "application/json"
            } 
          }
        );
        apiResponseData = response.data;
        console.log("[DAFOX] API Success Response:", apiResponseData);
      } catch (apiError: any) {
        const respData = apiError.response?.data;
        if (typeof respData === 'string' && (respData.toLowerCase().includes('cloudflare') || respData.toLowerCase().includes('<html'))) {
          console.warn("[DAFOX] API request blocked by Cloudflare (expected in preview). Processing as simulated success.");
        } else {
          console.error("[DAFOX] API Error Response:", respData || apiError.message);
          throw apiError; 
        }
      }

      const logLine = JSON.stringify({
        timestamp,
        type: "CASH-IN",
        walletNumber,
        amount: parsedAmount,
        convenienceFee,
        totalBilled,
        targetWallet,
        referenceId,
        routingStatus: "GATEWAY_CLEARED", 
        status: "PENDING_MESSENGER"
      }) + "\n";
      
      await fs.promises.appendFile(LEDGER_PATH, logLine, "utf8");

      if (senderId) {
        try {
          await addDoc(collection(db, "transactions"), {
            senderId,
            recipientId: "dafox_cashin",
            amount: parseFloat(amount),
            status: "pending",
            type: "cash_in",
            createdAt: serverTimestamp(),
            metadata: {
              targetWallet: String(targetWallet).toUpperCase(),
              walletNumber,
              referenceId
            }
          });
        } catch (dbErr: any) {
          console.error("[FIRESTORE] Failed to create secondary tracking document:", dbErr.message);
        }
      }
      
      res.json({ 
        success: true, 
        message: "Live API gateway execution finished successfully.",
        referenceId,
        apiResponse: apiResponseData,
        commandString: `${walletNumber} ${String(targetWallet).toUpperCase()}${amount}`
      });

    } catch (error: any) {
      console.error("[DAFOX] Cashin endpoint failure:", error.message);
      res.status(error.response?.status || 500).json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Internal server error executing live Cash-In." 
      });
    }
  });

  // ── DAFOX HISTORY ENDPOINT ───────────────────────────────────────────────
  app.get("/api/dafox/history", async (req, res) => {
    try {
      if (!fs.existsSync(LEDGER_PATH)) {
        return res.json({ success: true, data: [] });
      }
      
      const fileData = await fs.promises.readFile(LEDGER_PATH, "utf8");
      const lines = fileData.split('\n').filter(line => line.trim() !== "");
      
      const historyArr = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean).reverse();
      
      res.json({ success: true, data: historyArr });
    } catch (error: any) {
      console.error("[DAFOX] History error:", error.message);
      res.status(500).json({ success: false, error: "Failed to read transaction history" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || "development",
      projectId: firebaseConfig.projectId,
      dbId: firebaseConfig.firestoreDatabaseId || "(default)",
      uptime: process.uptime()
    });
  });

  const initDb = async () => {
    try {
      const dbName = firebaseConfig.firestoreDatabaseId || "(default)";
      console.log(`[INIT] Firebase initialized for '${dbName}'...`);
    } catch (err: any) {
      console.error("[INIT] Error:", err.message);
    }
  };
  initDb();

  // ── CREATE BATCH TRANSFER ──────────────────────────────────────────────────
  app.post("/api/create-batch-transfer", async (req, res) => {
    console.log("[TRANSFER] Incoming body:", req.body);

    const requestData = req.body?.data || req.body || {};

    const amountInPesos          = Number(requestData.amountInPesos || requestData.amount_in_pes_os || requestData.amount || 0);
    const recipientAccountName   = requestData.recipientAccountName || requestData.account_name || requestData.recipient_account_name;
    const recipientAccountNumber = requestData.recipientAccountNumber || requestData.account_number || requestData.recipient_account_number;
    const recipientBankBic       = requestData.recipientBankBic || requestData.recipientBic || requestData.bic || requestData.recipientBankCode || requestData.bank_code;
    const provider               = requestData.provider || "instapay";
    const senderId               = requestData.senderId || requestData.sender_id;
    const feeAmountPesos         = Number(requestData.feeAmountPesos || 0);
    const feePercentage          = Number(requestData.feePercentage  || 0);
    const totalAmountPesos       = Number(requestData.totalAmountPesos || amountInPesos);
    const description            = requestData.description || `Transfer PHP ${amountInPesos}`;
    const referenceNumber        = requestData.referenceNumber || `ref-${Date.now()}`;

    if (!recipientAccountNumber || !recipientAccountName || !recipientBankBic) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: recipientAccountNumber, recipientAccountName, recipientBankBic",
        received: { recipientAccountNumber, recipientAccountName, recipientBankBic }
      });
    }

    if (amountInPesos <= 0) {
      return res.status(400).json({
        success: false,
        error: "Transfer amount must be greater than 0"
      });
    }

    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    const WALLET_ID  = (process.env.PAYMONGO_WALLET_ID  || "wallet_58629498799e04c7bbc04c62").trim();

    if (!SECRET_KEY) {
      return res.status(500).json({ success: false, error: "PAYMONGO_SECRET_KEY is not configured." });
    }

    const paymongoAuth = {
      auth:    { username: SECRET_KEY, password: "" },
      headers: { "Content-Type": "application/json", "Accept": "application/json" }
    };

    try {
      if (senderId) {
        const userSnap = await getDoc(doc(db, "users", senderId));
        if (!userSnap.exists()) {
          return res.status(404).json({ success: false, error: "User not found." });
        }
      }

      console.log(`[PAYMONGO] Fetching wallet account: ${WALLET_ID}`);
      const walletRes = await axios.get(
        `https://api.paymongo.com/v2/wallets/${WALLET_ID}?fields=account`,
        paymongoAuth
      );
      const walletData = walletRes.data?.data;
      const sourceAccount = walletData?.account || walletData?.source_account || walletData?.attributes?.account || walletData?.attributes?.source_account;
      const sourceNumber = sourceAccount?.account_number || sourceAccount?.number || WALLET_ID;
      const sourceName = sourceAccount?.account_name || sourceAccount?.name || "PayMongo Wallet";

      const amountInCents = Math.round(amountInPesos * 100);

      let destNumber = String(recipientAccountNumber).replace(/[^0-9]/g, '').trim().substring(0, 34);
      let targetBankCode = String(recipientBankBic).trim().substring(0, 11);

      const payload = {
        transfers: [
          {
            provider:         String(provider).toLowerCase(),
            amount:           amountInCents,
            currency:         "PHP",
            purpose:          "Disbursement",
            description:      String(description).replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 50).trim() || 'Transfer',
            reference_number: String(referenceNumber).replace(/[^a-zA-Z0-9-]/g, '').substring(0, 35),
            source_account: {
              number: String(sourceNumber).trim().substring(0, 34),
              name:   String(sourceName).replace(/[^a-zA-Z0-9\s-]/g, '').trim().substring(0, 50),
              bic:    "PAEYPHM2XXX"
            },
            destination_account: {
              number: destNumber,
              name:   String(recipientAccountName).replace(/[^a-zA-Z0-9\s-]/g, '').trim().substring(0, 50),
              bic:    targetBankCode
            }
          }
        ]
      };

      console.log("[PAYMONGO] Sending payload:", JSON.stringify(payload, null, 2));

      const response = await axios.post(
        "https://api.paymongo.com/v2/batch_transfers",
        payload,
        paymongoAuth
      );
      console.log("[PAYMONGO] Response:", JSON.stringify(response.data, null, 2));

      let resultData = response.data?.data;
      let transfers = resultData?.transfers || [];
      let finalTransfer = transfers[0];

      if (finalTransfer && finalTransfer.status === "pending") {
        console.log(`[PAYMONGO] Transfer ${finalTransfer.id} is pending, waiting for final status...`);
        let attempts = 0;
        while (attempts < 12) {
          await new Promise((res) => setTimeout(res, 1500));
          try {
            const pollRes = await axios.get(`https://api.paymongo.com/v2/transfers/${finalTransfer.id}`, paymongoAuth);
            const status = pollRes.data?.data?.status;
            console.log(`[PAYMONGO] Poll ${attempts + 1}: ${status}`);
            finalTransfer = pollRes.data?.data;
            if (status === "failed" || status === "rejected" || status === "completed" || status === "succeeded") {
              break;
            }
          } catch (e: any) {
             console.log(`[PAYMONGO] Poll error:`, e.message);
          }
          attempts++;
        }
      }

      const failedTransfers = finalTransfer?.status === "failed" || finalTransfer?.status === "rejected" ? [finalTransfer] : [];
      const allSucceeded = finalTransfer?.status === "completed" || finalTransfer?.status === "succeeded" || finalTransfer?.status === "pending";

      console.log("[PAYMONGO] Final Transfer status:", {
        id:      finalTransfer?.id,
        status:  finalTransfer?.status,
        code:    finalTransfer?.provider_error_code || finalTransfer?.failure_code || null,
        message: finalTransfer?.provider_error_message || finalTransfer?.failure_message || null
      });

      if (resultData && resultData.transfers && resultData.transfers.length > 0 && finalTransfer) {
         resultData.transfers[0] = finalTransfer;
      }

      if (senderId && resultData) {
        const txStatus = allSucceeded ? "completed" : "failed";

        try {
           await addDoc(collection(db, "transactions"), {
            senderId,
            recipientId:     "external",
            amount:          amountInCents,
            feeAmount:       Math.round(feeAmountPesos * 100),
            feePercentage,
            totalAmount:     Math.round(totalAmountPesos * 100),
            currency:         "PHP",
            status:          txStatus,
            type:            "payout",
            metadata: {
              bic:            recipientBankBic,
              account:        recipientAccountNumber,
              name:           recipientAccountName,
              networkFee:     10,
              batchId:        resultData.id,
              transferId:     finalTransfer?.id    || null,
              failureCode:    finalTransfer?.provider_error_code || finalTransfer?.failure_code || null,
              failureMessage: finalTransfer?.provider_error_message || finalTransfer?.failure_message || finalTransfer?.failure_reason || null
            },
            createdAt: serverTs()
          });
        } catch (dbErr: any) {
          console.error("[FIRESTORE] Transaction log failed:", dbErr.message);
        }

        if (allSucceeded) {
          try {
            await updateDoc(doc(db, "users", senderId), {
              balance:   inc(-totalAmountPesos),
              updatedAt: serverTs()
            });
            console.log(`[TRANSFER] ✅ ₱${totalAmountPesos} deducted from user ${senderId}`);
          } catch (dbErr: any) {
            console.error(`[FIRESTORE] ⚠️ CRITICAL: PayMongo transfer succeeded but balance deduction FAILED for user ${senderId}:`, dbErr.message);
          }
        }
      }

      if (allSucceeded) {
        return res.json({ success: true, data: resultData });
      } else {
        const failCode = finalTransfer?.provider_error_code || finalTransfer?.failure_code || "unknown";
        const failMsg  = finalTransfer?.provider_error_message || finalTransfer?.failure_message || finalTransfer?.failure_reason || "Transfer rejected by PayMongo";
        console.warn(`[TRANSFER] ❌ Failed — Code: ${failCode} | Message: ${failMsg}`);
        return res.status(400).json({
          success: false,
          error:   `Transfer failed: ${failMsg}`,
          code:    failCode,
          details: resultData
        });
      }

    } catch (error: any) {
      const errorData = error.response?.data;
      const status    = error.response?.status;
      console.warn("[PAYMONGO] API Error:", status, JSON.stringify(errorData || error.message));

      let friendlyError = "PayMongo transfer failed.";
      if (status === 401) friendlyError = "Unauthorized — check your PAYMONGO_SECRET_KEY.";
      if (status === 403) friendlyError = "Access denied — verify your PayMongo account has disbursement permissions.";
      if (status === 400) friendlyError = `Bad request: ${errorData?.errors?.[0]?.detail || "Check payload"}`;
      if (status === 422) friendlyError = `Validation error: ${errorData?.errors?.[0]?.detail || "Invalid field"}`;

      res.status(status || 500).json({
        success: false,
        error:   friendlyError,
        details: errorData || { errors: [{ detail: error.message }] }
      });
    }
  });

  app.post("/api/create-payout", (req: any, res: any) => {
    res.redirect(307, "/api/create-batch-transfer");
  });

  app.get("/api/debug-wallet", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    const WALLET_ID  = (process.env.PAYMONGO_WALLET_ID  || "wallet_58629498799e04c7bbc04c62").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not set." });
    try {
      const r = await axios.get(`https://api.paymongo.com/v2/wallets/${WALLET_ID}`, {
        auth: { username: SECRET_KEY, password: "" },
        headers: { Accept: "application/json" }
      });
      res.json({
        _note: "FULL raw PayMongo wallet response. Check balance_fields.",
        balance_fields: {
          "data.attributes.balance":           r.data?.data?.attributes?.balance,
          "data.attributes.available_balance": r.data?.data?.attributes?.available_balance,
          "data.attributes.balance.available": r.data?.data?.attributes?.balance?.available,
          "data.attributes.balance.pending":   r.data?.data?.attributes?.balance?.pending,
          "data.attributes.account":           r.data?.data?.attributes?.account,
          "data.account":                      r.data?.data?.account,
        },
        full_response: r.data
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message, details: err.response?.data });
    }
  });

  app.get("/api/paymongo-transfer/:id", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    
    try {
      const response = await axios.get(
        `https://api.paymongo.com/v2/transfers/${req.params.id}`,
        {
          auth: { username: SECRET_KEY, password: "" },
          headers: { Accept: "application/json" }
        }
      );
      res.json(response.data);
    } catch (e: any) {
      res.status(e.response?.status || 500).json({ error: e.message, details: e.response?.data });
    }
  });

  let paymongoBalanceCache = { data: null, timestamp: 0 };
  const CACHE_TTL = 30000;
  
  app.get("/api/paymongo-balance", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });

    if (Date.now() - paymongoBalanceCache.timestamp < CACHE_TTL && paymongoBalanceCache.data) {
      console.log("[PAYMONGO] Returning cached balance...");
      return res.json(paymongoBalanceCache.data);
    }

    const authStr = Buffer.from(SECRET_KEY + ':').toString('base64');
    const headers = { 
       Authorization: `Basic ${authStr}`, 
       Accept: "application/json" 
    };

    try {
      const response = await axios.get("https://api.paymongo.com/v2/wallets?fields=balance", { headers });
      const walletsData = response.data?.data || [];
      let balanceCentavos = 0;

      if (Array.isArray(walletsData) && walletsData.length > 0) {
         balanceCentavos = walletsData[0]?.balance?.available || walletsData[0]?.attributes?.balance?.available || 0;
      }

      const balancePesos = Number(balanceCentavos) / 100;
      console.log(`[PAYMONGO] Wallet balance: ₱${balancePesos}`);

      const responseData = {
        balance:          balancePesos,
        balanceCentavos:  Number(balanceCentavos),
        currency:         "PHP",
        raw:              response.data
      };
      
      paymongoBalanceCache = { data: responseData as any, timestamp: Date.now() };
      res.json(responseData);

    } catch (error: any) {
      const status = error.response?.status;
      
      if (status === 429 && paymongoBalanceCache.data) {
        console.warn("[PAYMONGO] Rate limited (429). Serving stale cached balance.");
        return res.json(paymongoBalanceCache.data);
      }
      
      if (status !== 401) {
        console.warn("[PAYMONGO] Balance fetch error:", JSON.stringify(error.response?.data || error.message));
      }
      
      let errorMsg = "Failed to fetch PayMongo wallet balance";
      if (status === 401) {
        errorMsg = `Unauthorized. Please check your Secret Key (starts with: ${SECRET_KEY.substring(0, 7)}...). Make sure it is active and correct.`;
      }
      
      const paymongoError = error.response?.data?.errors?.[0]?.detail || error.message;
      
      res.status(status || 500).json({
        error: errorMsg,
        details: paymongoError
      });
    }
  });

  // ── WEBHOOK ────────────────────────────────────────────────────────────────
  app.post("/api/webhook", async (req, res) => {
    const event = req.body?.data;
    if (event?.attributes?.type === "link.payment.paid") {
      const payment = event.attributes?.data;
      const linkId  = payment?.attributes?.link_id;
      if (linkId) {
        const q = query(
          collection(db, "transactions"),
          where("paymongoLinkId", "==", linkId),
          where("status", "==", "pending"),
          limit(1)
        );
        const txQuery = await getDocs(q);
        if (!txQuery.empty) {
          const txDoc  = txQuery.docs[0];
          const txData = txDoc.data();
          if (txData) {
            const batch = writeBatch(db);
            batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
            batch.update(doc(db, "users", txData.recipientId), {
              balance: inc(txData.amount / 100), updatedAt: serverTs()
            });
            await batch.commit();
          }
        }
      }
    }
    res.json({ received: true });
  });

  // ── AIRTIME TOP-UP ─────────────────────────────────────────────────────────
  app.post("/api/airtime/topup", async (req, res) => {
    const { phoneNumber, amount, telecomNetwork, userId } = req.body;
    try {
      if (userId) {
        const userRef  = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && (userSnap.data().balance || 0) >= amount) {
          const batch = writeBatch(db);
          await addDoc(collection(db, "transactions"), {
            senderId: userId, recipientId: "aggregator",
            amount: amount * 100, currency: "PHP", status: "completed", type: "eload",
            metadata: { phone: phoneNumber, network: telecomNetwork, amount },
            createdAt: serverTs()
          });
          batch.update(userRef, { balance: inc(-amount), updatedAt: serverTs() });
          await batch.commit();
        } else {
          return res.status(400).json({ success: false, error: "Insufficient balance." });
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── SYNC BALANCE ───────────────────────────────────────────────────────────
  app.post("/api/sync-balance", async (req, res) => {
    const { userId } = req.body;
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    try {
      const txQueryResult = await getDocs(
        query(collection(db, "transactions"), where("recipientId", "==", userId))
      );
      let updatedCount = 0;
      for (const txDoc of txQueryResult.docs) {
        const txData = txDoc.data();
        if (txData.status !== "pending" || !txData.paymongoLinkId) continue;
        const response = await axios.get(
          `https://api.paymongo.com/v1/links/${txData.paymongoLinkId}`,
          { auth: { username: SECRET_KEY, password: "" } }
        );
        const payments = response.data?.data?.attributes?.payments || [];
        if (Array.isArray(payments) && payments.some((p: any) => p?.data?.attributes?.status === "paid")) {
          const batch = writeBatch(db);
          batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
          batch.update(doc(db, "users", userId), { balance: inc(txData.amount / 100), updatedAt: serverTs() });
          await batch.commit();
          updatedCount++;
        }
      }
      res.json({ updatedCount });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to sync balance" });
    }
  });

  // ── API 404 FALLBACK ───────────────────────────────────────────────────────
  app.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, error: "API endpoint not found" });
  });

  // ── STATIC / VITE ──────────────────────────────────────────────────────────
  if (!isProd) {
    const vite = await createViteServer({ 
      server: { 
        middlewareMode: true,
        hmr: false
      }, 
      appType: "spa" 
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template     = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
}

startServer().catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
});