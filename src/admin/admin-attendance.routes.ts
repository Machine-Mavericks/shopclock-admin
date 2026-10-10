import { Router } from "express";
import { exportAttendancePdf, getCurrentlyPunchedIn } from "./admin-attendance.controller";
import { requireAdminSession } from "./admin-auth.middleware";

const router = Router();

router.use(requireAdminSession);

router.get("/current", getCurrentlyPunchedIn);
router.get("/export", exportAttendancePdf);

export default router;
