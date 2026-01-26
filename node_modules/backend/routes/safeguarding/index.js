import express from "express";
import referralsRoutes from "./referrals.js";
import riskAssessmentsRoutes from "./risk-assessments.js";
import vulnerableUsersRoutes from "./vulnerable-users.js";
import multiAgencyRoutes from "./multi-agency.js";

const router = express.Router();

router.use("/referrals", referralsRoutes);
router.use("/risk-assessments", riskAssessmentsRoutes);
router.use("/vulnerable-users", vulnerableUsersRoutes);
router.use("/multi-agency", multiAgencyRoutes);

export default router;
