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
    // Fallback project target name
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
  const PORT = 3e3;
  const isProd = process.env.NODE_ENV === "production";
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
  app.post("/api/create-batch-transfer", async (req, res) => {
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
    const WALLET_ID = (process.env.PAYMONGO_WALLET_ID || "wallet_58629498799e04c7bbc04c62").trim();
    if (!SECRET_KEY) {
      return res.status(500).json({ success: false, error: "PAYMONGO_SECRET_KEY is not configured." });
    }
    const paymongoAuth = {
      auth: { username: SECRET_KEY, password: "" },
      headers: { "Content-Type": "application/json", "Accept": "application/json" }
    };
    try {
      if (senderId) {
        const userSnap = await (0, import_lite.getDoc)((0, import_lite.doc)(db, "users", senderId));
        if (!userSnap.exists()) {
          return res.status(404).json({ success: false, error: "User not found." });
        }
      }
      console.log(`[PAYMONGO] Fetching wallet account: ${WALLET_ID}`);
      const walletRes = await import_axios.default.get(
        `https://api.paymongo.com/v2/wallets/${WALLET_ID}?fields=account`,
        paymongoAuth
      );
      const walletData = walletRes.data?.data;
      const sourceAccount = walletData?.account || walletData?.source_account || walletData?.attributes?.account || walletData?.attributes?.source_account;
      const sourceNumber = sourceAccount?.account_number || sourceAccount?.number || WALLET_ID;
      const sourceName = sourceAccount?.account_name || sourceAccount?.name || "PayMongo Wallet";
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
      console.log("[PAYMONGO] Sending payload:", JSON.stringify(payload, null, 2));
      const response = await import_axios.default.post(
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
          await new Promise((res2) => setTimeout(res2, 1500));
          try {
            const pollRes = await import_axios.default.get(`https://api.paymongo.com/v2/transfers/${finalTransfer.id}`, paymongoAuth);
            const status = pollRes.data?.data?.status;
            console.log(`[PAYMONGO] Poll ${attempts + 1}: ${status}`);
            finalTransfer = pollRes.data?.data;
            if (status === "failed" || status === "rejected" || status === "completed" || status === "succeeded") {
              break;
            }
          } catch (e) {
            console.log(`[PAYMONGO] Poll error:`, e.message);
          }
          attempts++;
        }
      }
      const failedTransfers = finalTransfer?.status === "failed" || finalTransfer?.status === "rejected" ? [finalTransfer] : [];
      const allSucceeded = finalTransfer?.status === "completed" || finalTransfer?.status === "succeeded" || finalTransfer?.status === "pending";
      console.log("[PAYMONGO] Final Transfer status:", {
        id: finalTransfer?.id,
        status: finalTransfer?.status,
        code: finalTransfer?.provider_error_code || finalTransfer?.failure_code || null,
        message: finalTransfer?.provider_error_message || finalTransfer?.failure_message || null
      });
      if (resultData && resultData.transfers && resultData.transfers.length > 0 && finalTransfer) {
        resultData.transfers[0] = finalTransfer;
      }
      if (senderId && resultData) {
        const txStatus = allSucceeded ? "completed" : "failed";
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
              networkFee: 10,
              batchId: resultData.id,
              transferId: finalTransfer?.id || null,
              failureCode: finalTransfer?.provider_error_code || finalTransfer?.failure_code || null,
              failureMessage: finalTransfer?.provider_error_message || finalTransfer?.failure_message || finalTransfer?.failure_reason || null
            },
            createdAt: serverTs()
          });
        } catch (dbErr) {
          console.error("[FIRESTORE] Transaction log failed:", dbErr.message);
        }
        if (allSucceeded) {
          try {
            await (0, import_lite.updateDoc)((0, import_lite.doc)(db, "users", senderId), {
              balance: inc(-totalAmountPesos),
              updatedAt: serverTs()
            });
            console.log(`[TRANSFER] \u2705 \u20B1${totalAmountPesos} deducted from user ${senderId}`);
          } catch (dbErr) {
            console.error(`[FIRESTORE] \u26A0\uFE0F CRITICAL: PayMongo transfer succeeded but balance deduction FAILED for user ${senderId}:`, dbErr.message);
          }
        }
      }
      if (allSucceeded) {
        return res.json({ success: true, data: resultData });
      } else {
        const failCode = finalTransfer?.provider_error_code || finalTransfer?.failure_code || "unknown";
        const failMsg = finalTransfer?.provider_error_message || finalTransfer?.failure_message || finalTransfer?.failure_reason || "Transfer rejected by PayMongo";
        console.warn(`[TRANSFER] \u274C Failed \u2014 Code: ${failCode} | Message: ${failMsg}`);
        return res.status(400).json({
          success: false,
          error: `Transfer failed: ${failMsg}`,
          code: failCode,
          details: resultData
        });
      }
    } catch (error) {
      const errorData = error.response?.data;
      const status = error.response?.status;
      console.warn("[PAYMONGO] API Error:", status, JSON.stringify(errorData || error.message));
      let friendlyError = "PayMongo transfer failed.";
      if (status === 401) friendlyError = "Unauthorized \u2014 check your PAYMONGO_SECRET_KEY.";
      if (status === 403) friendlyError = "Access denied \u2014 verify your PayMongo account has disbursement permissions.";
      if (status === 400) friendlyError = `Bad request: ${errorData?.errors?.[0]?.detail || "Check payload"}`;
      if (status === 422) friendlyError = `Validation error: ${errorData?.errors?.[0]?.detail || "Invalid field"}`;
      res.status(status || 500).json({
        success: false,
        error: friendlyError,
        details: errorData || { errors: [{ detail: error.message }] }
      });
    }
  });
  app.post("/api/create-payout", (req, res) => {
    res.redirect(307, "/api/create-batch-transfer");
  });
  app.get("/api/debug-wallet", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    const WALLET_ID = (process.env.PAYMONGO_WALLET_ID || "wallet_58629498799e04c7bbc04c62").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not set." });
    try {
      const r = await import_axios.default.get(`https://api.paymongo.com/v2/wallets/${WALLET_ID}`, {
        auth: { username: SECRET_KEY, password: "" },
        headers: { Accept: "application/json" }
      });
      res.json({
        _note: "FULL raw PayMongo wallet response. Check balance_fields.",
        balance_fields: {
          "data.attributes.balance": r.data?.data?.attributes?.balance,
          "data.attributes.available_balance": r.data?.data?.attributes?.available_balance,
          "data.attributes.balance.available": r.data?.data?.attributes?.balance?.available,
          "data.attributes.balance.pending": r.data?.data?.attributes?.balance?.pending,
          "data.attributes.account": r.data?.data?.attributes?.account,
          "data.account": r.data?.data?.account
        },
        full_response: r.data
      });
    } catch (err) {
      res.status(500).json({ error: err.message, details: err.response?.data });
    }
  });
  app.get("/api/paymongo-transfer/:id", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    try {
      const response = await import_axios.default.get(
        `https://api.paymongo.com/v2/transfers/${req.params.id}`,
        {
          auth: { username: SECRET_KEY, password: "" },
          headers: { Accept: "application/json" }
        }
      );
      res.json(response.data);
    } catch (e) {
      res.status(e.response?.status || 500).json({ error: e.message, details: e.response?.data });
    }
  });
  let paymongoBalanceCache = { data: null, timestamp: 0 };
  const CACHE_TTL = 3e4;
  app.get("/api/paymongo-balance", async (req, res) => {
    const SECRET_KEY = (process.env.PAYMONGO_SECRET_KEY || "").trim();
    if (!SECRET_KEY) return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured." });
    if (Date.now() - paymongoBalanceCache.timestamp < CACHE_TTL && paymongoBalanceCache.data) {
      console.log("[PAYMONGO] Returning cached balance...");
      return res.json(paymongoBalanceCache.data);
    }
    const authStr = Buffer.from(SECRET_KEY + ":").toString("base64");
    const headers = {
      Authorization: `Basic ${authStr}`,
      Accept: "application/json"
    };
    try {
      const response = await import_axios.default.get("https://api.paymongo.com/v2/wallets?fields=balance", { headers });
      const walletsData = response.data?.data || [];
      let balanceCentavos = 0;
      if (Array.isArray(walletsData) && walletsData.length > 0) {
        balanceCentavos = walletsData[0]?.balance?.available || walletsData[0]?.attributes?.balance?.available || 0;
      }
      const balancePesos = Number(balanceCentavos) / 100;
      console.log(`[PAYMONGO] Wallet balance: \u20B1${balancePesos}`);
      const responseData = {
        balance: balancePesos,
        balanceCentavos: Number(balanceCentavos),
        currency: "PHP",
        raw: response.data
      };
      paymongoBalanceCache = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error) {
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
  app.post("/api/webhook", async (req, res) => {
    const event = req.body?.data;
    if (event?.attributes?.type === "link.payment.paid") {
      const payment = event.attributes?.data;
      const linkId = payment?.attributes?.link_id;
      if (linkId) {
        const q = (0, import_lite.query)(
          (0, import_lite.collection)(db, "transactions"),
          (0, import_lite.where)("paymongoLinkId", "==", linkId),
          (0, import_lite.where)("status", "==", "pending"),
          (0, import_lite.limit)(1)
        );
        const txQuery = await (0, import_lite.getDocs)(q);
        if (!txQuery.empty) {
          const txDoc = txQuery.docs[0];
          const txData = txDoc.data();
          if (txData) {
            const batch = (0, import_lite.writeBatch)(db);
            batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
            batch.update((0, import_lite.doc)(db, "users", txData.recipientId), {
              balance: inc(txData.amount / 100),
              updatedAt: serverTs()
            });
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
      const txQueryResult = await (0, import_lite.getDocs)(
        (0, import_lite.query)((0, import_lite.collection)(db, "transactions"), (0, import_lite.where)("recipientId", "==", userId))
      );
      let updatedCount = 0;
      for (const txDoc of txQueryResult.docs) {
        const txData = txDoc.data();
        if (txData.status !== "pending" || !txData.paymongoLinkId) continue;
        const response = await import_axios.default.get(
          `https://api.paymongo.com/v1/links/${txData.paymongoLinkId}`,
          { auth: { username: SECRET_KEY, password: "" } }
        );
        const payments = response.data?.data?.attributes?.payments || [];
        if (Array.isArray(payments) && payments.some((p) => p?.data?.attributes?.status === "paid")) {
          const batch = (0, import_lite.writeBatch)(db);
          batch.update(txDoc.ref, { status: "completed", updatedAt: serverTs() });
          batch.update((0, import_lite.doc)(db, "users", userId), { balance: inc(txData.amount / 100), updatedAt: serverTs() });
          await batch.commit();
          updatedCount++;
        }
      }
      res.json({ updatedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to sync balance" });
    }
  });
  if (!isProd) {
    const vite = await (0, import_vite.createServer)({
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
