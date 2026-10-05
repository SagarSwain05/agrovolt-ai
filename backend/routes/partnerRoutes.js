const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const c = require("../controllers/partnerController");

// Farmer ↔ partner linking and partner (EPC/FPO) portal
const epc = express.Router();
epc.get("/partner", protect, c.myPartner);
epc.post("/link", protect, c.link);
epc.delete("/link", protect, c.unlink);
epc.get("/fleet", protect, c.fleet);
epc.get("/keys", protect, c.listKeys);
epc.post("/keys", protect, c.createKey);
epc.put("/keys/:id", protect, c.updateKey);
epc.delete("/keys/:id", protect, c.deleteKey);
epc.post("/keys/:id/test", protect, c.testWebhook);

// White-label API
const api = express.Router();
api.use(c.apiAuth);
api.post("/crop-recommendation", c.apiCrop);
api.post("/solar-estimate", c.apiSolar);
api.get("/disease-risk", c.apiRisk);
api.post("/panel-diagnostics", c.apiPanelDiagnostics);
api.post("/crop-diagnostics", c.apiCropDiagnostics);

module.exports = { epc, api };
