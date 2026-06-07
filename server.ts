import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import cors from "cors"; // ✅ IMPORT VERIFIED
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
// ───────────────────────────────────────────────────────────────────────────────

const serverTs = serverTimestamp;
const inc = increment;

async function startServer() {
  const app = express();
  
  const PORT = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === "production";

  // ✅ ACTIVE INTERCEPTOR: Authorized pipeline origins to smash CORS Network Blocks
  app.use(cors({
    origin: [
      "https://cbkpos.web.app",
      "https://ai-studio-applet-webapp-10d3d.web.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }));

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

  // ── CENTRAL TRANSFER CORE REUSABLE CONTROLLER ──────────────────────────────
  const handleBatchTransferExecution = async (req: express.Request, res: express.Response) => {
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

    if (!recipientAccountNumber || !recipientAccountName || !recipientBankBic) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: recipientAccountNumber, recipientAccountName, recipientBankBic"
      });
    }

    if (amountInPesos <= 0) {
      return res.status(400).json({ success: false, error: "Transfer amount must be greater than 0" });
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

      // ✅ FIXED: Shifted endpoints from explicit resource lookup to default query parameters to drop the "wallet not found" block
      console.log(`[PAYMONGO] Querying primary activated default wallet metrics...`);
      const walletRes = await axios.get(`https://api.paymongo.com/v2/wallets?fields=account`, paymongoAuth);
      const walletData = walletRes.data?.data?.[0]; // Target the primary activated index block
      const sourceAccount = walletData?.account || walletData?.attributes?.account;
      const sourceNumber = sourceAccount?.account_number || WALLET_ID;
      const sourceName = sourceAccount?.account_name || "PayMongo Wallet";

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

      const response = await axios.post("https://api.paymongo.com/v2/batch_transfers", payload, paymongoAuth);
      let resultData = response.data?.data;
      let finalTransfer = resultData?.transfers?.[0];

      if (finalTransfer && finalTransfer.status === "pending") {
        let attempts = 0;
        while (attempts < 12) {
          await new Promise((res) => setTimeout(res, 1500));
          try {
            const pollRes = await axios.get(`https://api.paymongo.com/v2/transfers/${finalTransfer.id}`, paymongoAuth);
            const status = pollRes.data?.data?.status;
            finalTransfer = pollRes.data?.data;
            if (status === "failed" || status === "rejected" || status === "completed" || status === "succeeded") break;
          } catch (e: any) {
             console.log(`[PAYMONGO] Poll error:`, e.message);
          }
          attempts++;
        }
      }

      const allSucceeded = finalTransfer?.status === "completed" || finalTransfer?.status === "succeeded" || finalTransfer?.status === "pending";

      if (senderId && resultData) {
        const txStatus = allSucceeded ? "completed" : "failed";
        try {
           await addDoc(collection(db, "transactions"), {
            senderId,
            recipientId: "external",
            amount: amountInCents,
            feeAmount: Math.round(feeAmountPesos * 100),
            feePercentage,
            totalAmount: Math.round(totalAmountPesos * 100),
            currency: "PHP",
            status: txStatus,
            type: "payout",
            metadata: {
              bic: recipientBankBic,
              account: recipientAccountNumber,
              name: recipientAccountName,
              batchId: resultData.id,
              transferId: finalTransfer?.id || null
            },
            createdAt: serverTs()
          });
        } catch (dbErr: any) {
          console.error("[FIRESTORE] Transaction log failed:", dbErr.message);
        }

        if (allSucceeded) {
          try {
            await updateDoc(doc(db, "users", senderId), {
              balance: inc(-totalAmountPesos),
              updatedAt: serverTs()
            });
          } catch (dbErr: any) {
            console.error(`[FIRESTORE] Deduction error for user ${senderId}:`, dbErr.message);
          }
        }
      }

      if (allSucceeded) {
        return res.json({ success: true, data: resultData });
      } else {
        const paymongoFailureReason = finalTransfer?.failure_reason || finalTransfer?.attributes?.failure_reason || "Transfer rejected by PayMongo";
        return res.status(400).json({ success: false, error: paymongoFailureReason, details: resultData });
      }

    } catch (error: any) {
      const internalErrorDetails = 
        error.response?.data?.errors?.[0]?.detail || 
        error.response?.data?.error || 
        error.message;
      res.status(error.response?.status || 500).json({ success: false, error: internalErrorDetails });
    }
  };

  // Map endpoints to execution layers
  app.post("/api/create-batch-transfer", handleBatchTransferExecution);
  app.post("/api/create-payout", handleBatchTransferExecution);

  // ── DEBUG WALLET ───────────────────────────────────────────────────────────
  app.get("/api/debug-wallet", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not set." });
    try {
      // ✅ FIXED: Swapped query path here to map array collections safely
      const r = await axios.get(`https://api.paymongo.com/v2/wallets`, {
        auth: { username: SECRET_KEY, password: "" },
        headers: { Accept: "application/json" }
      });
      res.json({ full_response: r.data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET SINGLE TRANSFER ───────────────────────────────────────────────────
  app.get("/api/paymongo-transfer/:id", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    try {
      const response = await axios.get(`https://api.paymongo.com/v2/transfers/${req.params.id}`, {
        auth: { username: SECRET_KEY, password: "" },
        headers: { Accept: "application/json" }
      });
      res.json(response.data);
    } catch (e: any) {
      res.status(e.response?.status || 500).json({ error: e.message });
    }
  });

  // ── GET PAYMONGO BALANCE ───────────────────────────────────────────────────
  let paymongoBalanceCache = { data: null, timestamp: 0 };
  const CACHE_TTL = 30000; 
  
  app.get("/api/paymongo-balance", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });

    if (Date.now() - paymongoBalanceCache.timestamp < CACHE_TTL && paymongoBalanceCache.data) {
      return res.json(paymongoBalanceCache.data);
    }

    const authStr = Buffer.from(SECRET_KEY + ':').toString('base64');
    const headers = { Authorization: `Basic ${authStr}`, Accept: "application/json" };

    try {
      const response = await axios.get("https://api.paymongo.com/v2/wallets?fields=balance", { headers });
      const walletsData = response.data?.data || [];
      let balanceCentavos = 0;

      if (Array.isArray(walletsData) && walletsData.length > 0) {
         balanceCentavos = walletsData[0]?.balance?.available || walletsData[0]?.attributes?.balance?.available || 0;
      }

      const balancePesos = Number(balanceCentavos) / 100;
      const responseData = { balance: balancePesos, balanceCentavos, currency: "PHP" };
      
      paymongoBalanceCache = { data: responseData as any, timestamp: Date.now() };
      res.json(responseData);

    } catch (error: any) {
      const status = error.response?.status;
      if (status === 429 && paymongoBalanceCache.data) return res.json(paymongoBalanceCache.data);
      
      res.status(status || 500).json({ error: "Failed to fetch balance", details: error.message });
    }
  });

  // ── WEBHOOK ────────────────────────────────────────────────────────────────
  app.post("/api/webhook", async (req, res) => {
    const event = req.body?.data;
    if (event?.attributes?.type === "link.payment.paid") {
      const payment = event.attributes?.data;
      const linkId  = payment?.attributes?.link_id;
      if (linkId) {
        const q = query(collection(db, "transactions"), where("paymongoLinkId", "==", linkId), where("status", "==", "pending"), limit(1));
        const txQuery = await getDocs(q);
        if (!txQuery.empty) {
          const txDoc = txQuery.docs[0];
          const txData = txDoc.data();
          if (txData) {
            const batch = writeBatch(db);
            batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
            batch.update(doc(db, "users", txData.recipientId), { balance: inc(txData.amount / 100), updatedAt: serverTs() });
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
      const txQueryResult = await getDocs(query(collection(db, "transactions"), where("recipientId", "==", userId)));
      for (const txDoc of txQueryResult.docs) {
        const txData = txDoc.data();
        if (txData.status !== "pending" || !txData.paymongoLinkId) continue;
        const response = await axios.get(`https://api.paymongo.com/v1/links/${txData.paymongoLinkId}`, { auth: { username: SECRET_KEY, password: "" } });
        const payments = response.data?.data?.attributes?.payments || [];
        if (Array.isArray(payments) && payments.some((p: any) => p?.data?.attributes?.status === "paid")) {
          const batch = writeBatch(db);
          batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
          batch.update(doc(db, "users", userId), { balance: inc(txData.amount / 100), updatedAt: serverTs() });
          await batch.commit();
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to sync balance" });
    }
  });

  // ── STATIC / VITE ──────────────────────────────────────────────────────────
  if (!isProd) {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: { overlay: false } }, appType: "spa" });
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