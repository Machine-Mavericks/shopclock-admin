import { Router } from "express";
import { fluxerCallback, fluxerLogin, localLogin, logout, me } from "./admin-auth.controller";
import { requireAdminSession } from "./admin-auth.middleware";

const router = Router();

router.get("/fluxer/login", fluxerLogin);
router.get("/fluxer/callback", fluxerCallback);
router.post("/local/login", localLogin);
router.post("/logout", logout);
router.get("/me", requireAdminSession, me);

export default router;
