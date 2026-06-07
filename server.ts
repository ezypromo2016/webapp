import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
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

// ✅ PLACE THIS EXACT FALLBACK BLOCK HERE:
let firebaseConfig;
try {
  // 1. Attempt to load your local file wrapper for your computer tests
  firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  console.log("[CONFIG] Loaded configuration from local JSON applet asset file.");
} catch (e) {
  // 2. Automated fallback: Pull the dynamic variables directly from Firebase's cloud containers
  console.log("[CONFIG] Local JSON file missing. Swapping variables to Cloud Environment context...");
  firebaseConfig = {
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "cbkapparel-shop", // Fallback project target name
    firestoreDatabaseId: "(default)"
  };
}

// Initialize Admin safely using our resolved data configuration values
if (getApps().length === 0) {
  initializeApp({ projectId: firebaseConfig.projectId });
}

// Initialize Client SDK
const clientApp = initializeClientApp(firebaseConfig);
let db = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
// ───────────────────────────────────────────────────────────────────────────────

const serverTs = serverTimestamp;
const inc = increment;

async function startServer() {
  const app = express();
 const PORT = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === "production";

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

    const amountInPesos          = Number(requestData.amountInPesos || requestData.amount_in_pesos || requestData.amount || 0);
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

    // ── 1. Validate required fields ──────────────────────────────────────────
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

      // ── 3. Fetch wallet account details using ?fields=account ──────────
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

      // Clean up destination account numbers and normalize bank routing tokens
      let destNumber = String(recipientAccountNumber).replace(/[^0-9]/g, '').trim().substring(0, 34);
      let targetBankCode = String(recipientBankBic).trim().substring(0, 11);

      // ── 5. Build Corrected PayMongo Batch Transfer Payload ─────────────────
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

      // ── 6. Submit to PayMongo ────────────────────────────────────────────
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

      // Update the resultData with the latest polled transfer status so client sees it
      if (resultData && resultData.transfers && resultData.transfers.length > 0 && finalTransfer) {
         resultData.transfers[0] = finalTransfer;
      }

      // ── 7. Only deduct balance if PayMongo ACTUALLY succeeded ────────────
      // This is the critical guard — no deduction on failure
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
            currency:        "PHP",
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
          // ✅ Deduct ONLY after confirmed success
          try {
            await updateDoc(doc(db, "users", senderId), {
              balance:   inc(-totalAmountPesos),
              updatedAt: serverTs()
            });
            console.log(`[TRANSFER] ✅ ₱${totalAmountPesos} deducted from user ${senderId}`);
          } catch (dbErr: any) {
            // Transfer succeeded but deduction failed — log for manual reconciliation
            console.error(`[FIRESTORE] ⚠️ CRITICAL: PayMongo transfer succeeded but balance deduction FAILED for user ${senderId}:`, dbErr.message);
          }
        }
      }

      if (allSucceeded) {
        return res.json({ success: true, data: resultData });
      } else {
        // ❌ Transfer failed
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

      // ❌ Never deduct balance on error
      res.status(status || 500).json({
        success: false,
        error:   friendlyError,
        details: errorData || { errors: [{ detail: error.message }] }
      });
    }
  });


  // Alias
  app.post("/api/create-payout", (req: any, res: any) => {
    res.redirect(307, "/api/create-batch-transfer");
  });



  // ── DEBUG: Raw wallet response — visit /api/debug-wallet in browser ──────
  // Shows EXACT balance field names PayMongo returns. DELETE after confirming.
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

  // ── GET SINGLE TRANSFER ───────────────────────────────────────────────────
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

  // ── GET PAYMONGO BALANCE ───────────────────────────────────────────────────
  let paymongoBalanceCache = { data: null, timestamp: 0 };
  const CACHE_TTL = 30000; // 30 seconds cache for balance API
  
  app.get("/api/paymongo-balance", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    const WALLET_ID  = (process.env.PAYMONGO_WALLET_ID  || "wallet_58629498799e04c7bbc04c62").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });

    if (Date.now() - paymongoBalanceCache.timestamp < CACHE_TTL && paymongoBalanceCache.data) {
      console.log("[PAYMONGO] Returning cached balance...");
      return res.json(paymongoBalanceCache.data);
    }

    const auth = { auth: { username: SECRET_KEY, password: "" }, headers: { Accept: "application/json" } };
    try {
      // Fetch balance and account in parallel using ?fields= query param
      const [balanceRes, accountRes] = await Promise.all([
        axios.get(`https://api.paymongo.com/v2/wallets/${WALLET_ID}?fields=balance`, auth),
        axios.get(`https://api.paymongo.com/v2/wallets/${WALLET_ID}?fields=account`, auth),
      ]);

      console.log("[PAYMONGO] Balance fields response:", JSON.stringify(balanceRes.data, null, 2));
      console.log("[PAYMONGO] Account fields response:", JSON.stringify(accountRes.data, null, 2));

      const balanceData  = balanceRes.data?.data;
      const accountData  = accountRes.data?.data;

      // Balance — PayMongo returns centavos
      const balanceCentavos =
        balanceData?.balance?.available ??
        balanceData?.balance?.value     ??
        balanceData?.available_balance  ??
        balanceData?.balance            ??
        0;

      const balancePesos = Number(balanceCentavos) / 100;

      // Account details needed for transfers
      const account =
        accountData?.account ||
        accountData?.source_account ||
        null;

      console.log(`[PAYMONGO] Wallet balance: ₱${balancePesos} | Account:`, JSON.stringify(account));

      const responseData = {
        balance:          balancePesos,
        balanceCentavos:  Number(balanceCentavos),
        currency:         "PHP",
        walletId:         WALLET_ID,
        account,
        wallet: { id: WALLET_ID, attributes: { available_balance: Number(balanceCentavos), balance: { available: Number(balanceCentavos), pending: 0 }, account } },
        merchant: { attributes: { available: [{ currency: "PHP", amount: 0 }], pending: [{ currency: "PHP", amount: 0 }] } },
        raw: {
          balance: balanceRes.data,
          account: accountRes.data
        }
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
        if (WALLET_ID === "wallet_58629498799e04c7bbc04c62") {
          errorMsg = "Unauthorized. You are using the default WALLET_ID. Please set PAYMONGO_WALLET_ID in your environment variables/settings to your own PayMongo Wallet ID.";
        } else {
          errorMsg = "Unauthorized. Please check if your PayMongo Secret Key and Wallet ID are correct.";
        }
      }
      
      res.status(status || 500).json({
        error: errorMsg,
        details: error.response?.data || error.message
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


  // ── STATIC / VITE ──────────────────────────────────────────────────────────
  if (!isProd) {
    const vite = await createViteServer({ 
      server: { 
        middlewareMode: true,
        hmr: {
          overlay: false
        }
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