import express from "express";
import permissionsRoutes from "./permissions.js";
import groupsRolesRoutes from "./groups-roles.js";

const router = express.Router();

router.use("/", permissionsRoutes);
router.use("/", groupsRolesRoutes);

export default router;
