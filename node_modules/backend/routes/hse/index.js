import express from "express";
import hseIncidentsRoutes from "./incidents.js";
import hseRiskManagementRoutes from "./risk-management.js";
import hseTrainingRoutes from "./training.js";
import hseAuditsRoutes from "./audits.js";

const router = express.Router();

router.use("/hse-incidents", hseIncidentsRoutes);
router.use("/risk-management", hseRiskManagementRoutes);
router.use("/training", hseTrainingRoutes);
router.use("/audits", hseAuditsRoutes);

export default router;
