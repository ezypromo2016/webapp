var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_axios = __toESM(require("axios"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_app = require("firebase-admin/app");
var import_app2 = require("firebase/app");
var import_lite = require("firebase/firestore/lite");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_fs = __toESM(require("fs"), 1);
import_dotenv.default.config({ override: true });
var firebaseConfig;
try {
  firebaseConfig = JSON.parse(import_fs.default.readFileSync("./firebase-applet-config.json", "utf-8"));
  console.log("[CONFIG] Loaded configuration from local JSON applet asset file.");
} catch (e) {
  console.log("[CONFIG] Local JSON file missing. Swapping variables to Cloud Environment context...");
  firebaseConfig = {
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "cbkapparel-shop",
    firestoreDatabaseId: "(default)"
  };
}
if ((0, import_app.getApps)().length === 0) {
  (0, import_app.initializeApp)({ projectId: firebaseConfig.projectId });
}
var clientApp = (0, import_app2.initializeApp)(firebaseConfig);
var db = (0, import_lite.getFirestore)(clientApp, firebaseConfig.firestoreDatabaseId);
var serverTs = import_lite.serverTimestamp;
var inc = import_lite.increment;
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.PORT || 3e3;
  const isProd = process.env.NODE_ENV === "production";
  const allowedOrigins = [
    "https://cbkpos.web.app",
    "https://cbkpos.firebaseapp.com",
    "https://ai-studio-applet-webapp-10d3d.web.app",
    "https://ai-studio-applet-webapp-10d3d.firebaseapp.com"
  ];
  app.use((0, import_cors.default)({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.includes("cbkpos") || origin.includes("ai-studio-applet-webapp") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }
      console.warn(`[CORS BLOCKED] Unauthorized Domain Connection Rejected: ${origin}`);
      return callback(new Error("Not allowed by CORS security rules"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  }));
  app.use(import_express.default.json());
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server (PID ${process.pid}) running on http://0.0.0.0:${PORT}`);
  });
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.error(`[SERVER] Port ${PORT} already in use.`);
    } else {
      console.error(`[SERVER] ERROR:`, e);
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      time: (/* @__PURE__ */ new Date()).toISOString(),
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
    } catch (err) {
      console.error("[INIT] Error:", err.message);
    }
  };
  initDb();
  const handleBatchTransferExecution = async (req, res) => {
    console.log("[TRANSFER] Incoming body:", req.body);
    const requestData = req.body?.data || req.body || {};
    const amountInPesos = Number(requestData.amountInPesos || requestData.amount_in_pesos || requestData.amount || 0);
    const recipientAccountName = requestData.recipientAccountName || requestData.account_name || requestData.recipient_account_name;
    const recipientAccountNumber = requestData.recipientAccountNumber || requestData.account_number || requestData.recipient_account_number;
    const recipientBankBic = requestData.recipientBankBic || requestData.recipientBic || requestData.bic || requestData.recipientBankCode || requestData.bank_code;
    const provider = requestData.provider || "instapay";
    const senderId = requestData.senderId || requestData.sender_id;
    const feeAmountPesos = Number(requestData.feeAmountPesos || 0);
    const feePercentage = Number(requestData.feePercentage || 0);
    const totalAmountPesos = Number(requestData.totalAmountPesos || amountInPesos);
    const description = requestData.description || `Transfer PHP ${amountInPesos}`;
    const referenceNumber = requestData.referenceNumber || `ref-${Date.now()}`;
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
    const WALLET_ID = (process.env.PAYMONGO_WALLET_ID || "wallet_58629498799e04c7bbc04c62").trim();
    if (!SECRET_KEY) {
      return res.status(500).json({ success: false, error: "PAYMONGO_SECRET_KEY is not configured." });
    }
    const authStr = Buffer.from(SECRET_KEY + ":").toString("base64");
    const secureHeaders = {
      Authorization: `Basic ${authStr}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    try {
      if (senderId) {
        const userSnap = await (0, import_lite.getDoc)((0, import_lite.doc)(db, "users", senderId));
        if (!userSnap.exists()) {
          return res.status(404).json({ success: false, error: "User not found." });
        }
      }
      console.log(`[PAYMONGO] Querying primary default wallet accounts...`);
      const walletRes = await import_axios.default.get(`https://api.paymongo.com/v2/wallets?fields=account`, { headers: secureHeaders });
      const walletData = walletRes.data?.data?.[0];
      const sourceAccount = walletData?.account || walletData?.attributes?.account;
      const sourceNumber = sourceAccount?.account_number || WALLET_ID;
      const sourceName = sourceAccount?.account_name || "PayMongo Wallet";
      const amountInCents = Math.round(amountInPesos * 100);
      let destNumber = String(recipientAccountNumber).replace(/[^0-9]/g, "").trim().substring(0, 34);
      let targetBankCode = String(recipientBankBic).trim().substring(0, 11);
      const payload = {
        transfers: [
          {
            provider: String(provider).toLowerCase(),
            amount: amountInCents,
            currency: "PHP",
            purpose: "Disbursement",
            description: String(description).replace(/[^a-zA-Z0-9\s-]/g, "").substring(0, 50).trim() || "Transfer",
            reference_number: String(referenceNumber).replace(/[^a-zA-Z0-9-]/g, "").substring(0, 35),
            source_account: {
              number: String(sourceNumber).trim().substring(0, 34),
              name: String(sourceName).replace(/[^a-zA-Z0-9\s-]/g, "").trim().substring(0, 50),
              bic: "PAEYPHM2XXX"
            },
            destination_account: {
              number: destNumber,
              name: String(recipientAccountName).replace(/[^a-zA-Z0-9\s-]/g, "").trim().substring(0, 50),
              bic: targetBankCode
            }
          }
        ]
      };
      console.log(`[PAYMONGO] Executing batch transfer payout payload...`);
      const response = await import_axios.default.post("https://api.paymongo.com/v2/batch_transfers", payload, { headers: secureHeaders });
      let resultData = response.data?.data;
      let finalTransfer = resultData?.transfers?.[0];
      if (finalTransfer && (finalTransfer.status === "pending" || finalTransfer.attributes?.status === "pending")) {
        let attempts = 0;
        while (attempts < 12) {
          await new Promise((res2) => setTimeout(res2, 1500));
          try {
            console.log(`[POLL] Checking status for transfer ${finalTransfer.id}, attempt ${attempts + 1}...`);
            const pollRes = await import_axios.default.get(`https://api.paymongo.com/v2/transfers/${finalTransfer.id}`, { headers: secureHeaders });
            const rawTx = pollRes.data?.data;
            const currentStatus = rawTx?.status || rawTx?.attributes?.status;
            if (rawTx) {
              finalTransfer = rawTx;
            }
            if (currentStatus === "failed" || currentStatus === "rejected" || currentStatus === "completed" || currentStatus === "succeeded") {
              console.log(`[POLL] Terminal status reached: ${currentStatus}`);
              break;
            }
          } catch (e) {
            console.log(`[PAYMONGO] Poll error:`, e.message);
          }
          attempts++;
        }
      }
      const finalStatus = finalTransfer?.status || finalTransfer?.attributes?.status;
      const allSucceeded = finalStatus === "completed" || finalStatus === "succeeded" || finalStatus === "pending";
      if (senderId && resultData) {
        const txStatus = finalStatus === "failed" || finalStatus === "rejected" ? "failed" : allSucceeded ? "completed" : "pending";
        try {
          await (0, import_lite.addDoc)((0, import_lite.collection)(db, "transactions"), {
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
        } catch (dbErr) {
          console.error("[FIRESTORE] Transaction log failed:", dbErr.message);
        }
        if (txStatus === "completed" || txStatus === "pending") {
          try {
            await (0, import_lite.updateDoc)((0, import_lite.doc)(db, "users", senderId), {
              balance: inc(-totalAmountPesos),
              updatedAt: serverTs()
            });
          } catch (dbErr) {
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
    } catch (error) {
      const internalErrorDetails = error.response?.data?.errors?.[0]?.detail || error.response?.data?.error || error.message;
      res.status(error.response?.status || 500).json({ success: false, error: internalErrorDetails });
    }
  };
  app.post("/api/create-batch-transfer", handleBatchTransferExecution);
  app.post("/api/create-payout", handleBatchTransferExecution);
  app.get("/api/debug-wallet", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not set." });
    try {
      const authStr = Buffer.from(SECRET_KEY + ":").toString("base64");
      const r = await import_axios.default.get(`https://api.paymongo.com/v2/wallets`, {
        headers: { Authorization: `Basic ${authStr}`, Accept: "application/json" }
      });
      res.json({ full_response: r.data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/paymongo-transfer/:id", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    try {
      const authStr = Buffer.from(SECRET_KEY + ":").toString("base64");
      const response = await import_axios.default.get(`https://api.paymongo.com/v2/transfers/${req.params.id}`, {
        headers: { Authorization: `Basic ${authStr}`, Accept: "application/json" }
      });
      res.json(response.data);
    } catch (e) {
      res.status(e.response?.status || 500).json({ error: e.message });
    }
  });
  let paymongoBalanceCache = { data: null, timestamp: 0 };
  const CACHE_TTL = 3e4;
  app.get("/api/paymongo-balance", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    if (Date.now() - paymongoBalanceCache.timestamp < CACHE_TTL && paymongoBalanceCache.data) {
      return res.json(paymongoBalanceCache.data);
    }
    const authStr = Buffer.from(SECRET_KEY + ":").toString("base64");
    const headers = { Authorization: `Basic ${authStr}`, Accept: "application/json" };
    try {
      const response = await import_axios.default.get("https://api.paymongo.com/v2/wallets?fields=balance", { headers });
      const walletsData = response.data?.data || [];
      let balanceCentavos = 0;
      if (Array.isArray(walletsData) && walletsData.length > 0) {
        balanceCentavos = walletsData[0]?.balance?.available || walletsData[0]?.attributes?.balance?.available || 0;
      }
      const balancePesos = Number(balanceCentavos) / 100;
      const responseData = { balance: balancePesos, balanceCentavos, currency: "PHP" };
      paymongoBalanceCache = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error) {
      const status = error.response?.status;
      if (status === 429 && paymongoBalanceCache.data) return res.json(paymongoBalanceCache.data);
      res.status(status || 500).json({ error: "Failed to fetch balance", details: error.message });
    }
  });
  app.post("/api/webhook", async (req, res) => {
    const event = req.body?.data;
    if (event?.attributes?.type === "link.payment.paid") {
      const payment = event.attributes?.data;
      const linkId = payment?.attributes?.link_id;
      if (linkId) {
        const q = (0, import_lite.query)((0, import_lite.collection)(db, "transactions"), (0, import_lite.where)("paymongoLinkId", "==", linkId), (0, import_lite.where)("status", "==", "pending"), (0, import_lite.limit)(1));
        const txQuery = await (0, import_lite.getDocs)(q);
        if (!txQuery.empty) {
          const txDoc = txQuery.docs[0];
          const txData = txDoc.data();
          if (txData) {
            const batch = (0, import_lite.writeBatch)(db);
            batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
            batch.update((0, import_lite.doc)(db, "users", txData.recipientId), { balance: inc(txData.amount / 100), updatedAt: serverTs() });
            await batch.commit();
          }
        }
      }
    }
    res.json({ received: true });
  });
  app.post("/api/airtime/topup", async (req, res) => {
    const { phoneNumber, amount, telecomNetwork, userId } = req.body;
    try {
      if (userId) {
        const userRef = (0, import_lite.doc)(db, "users", userId);
        const userSnap = await (0, import_lite.getDoc)(userRef);
        if (userSnap.exists() && (userSnap.data().balance || 0) >= amount) {
          const batch = (0, import_lite.writeBatch)(db);
          await (0, import_lite.addDoc)((0, import_lite.collection)(db, "transactions"), {
            senderId: userId,
            recipientId: "aggregator",
            amount: amount * 100,
            currency: "PHP",
            status: "completed",
            type: "eload",
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
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/sync-balance", async (req, res) => {
    const { userId } = req.body;
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    try {
      const authStr = Buffer.from(SECRET_KEY + ":").toString("base64");
      const txQueryResult = await (0, import_lite.getDocs)((0, import_lite.query)((0, import_lite.collection)(db, "transactions"), (0, import_lite.where)("recipientId", "==", userId)));
      for (const txDoc of txQueryResult.docs) {
        const txData = txDoc.data();
        if (txData.status !== "pending" || !txData.paymongoLinkId) continue;
        const response = await import_axios.default.get(`https://api.paymongo.com/v1/links/${txData.paymongoLinkId}`, { headers: { Authorization: `Basic ${authStr}` } });
        const payments = response.data?.data?.attributes?.payments || [];
        if (Array.isArray(payments) && payments.some((p) => p?.data?.attributes?.status === "paid")) {
          const batch = (0, import_lite.writeBatch)(db);
          batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
          batch.update((0, import_lite.doc)(db, "users", userId), { balance: inc(txData.amount / 100), updatedAt: serverTs() });
          await batch.commit();
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to sync balance" });
    }
  });
  if (!isProd) {
    const vite = await (0, import_vite.createServer)({ server: { middlewareMode: true, hmr: { overlay: false } }, appType: "spa" });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      try {
        let template = import_fs.default.readFileSync(import_path.default.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => res.sendFile(import_path.default.join(distPath, "index.html")));
  }
}
startServer().catch((err) => {
  console.error("CRITICAL: Server failed to start:", err);
});
//# sourceMappingURL=server.cjs.map
