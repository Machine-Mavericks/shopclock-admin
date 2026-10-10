import { Router } from "express";
import {
  addFluxerAdminIdHandler,
  createLocalAdmin,
  listAdmins,
  removeFluxerAdminIdHandler,
  setLocalAdminDisabled,
} from "./admin-admins.controller";
import { requireAdminSession } from "./admin-auth.middleware";

const router = Router();

router.use(requireAdminSession);

router.get("/", listAdmins);
router.post("/local", createLocalAdmin);
router.post("/local/:id/disabled", setLocalAdminDisabled);
router.post("/fluxer", addFluxerAdminIdHandler);
router.delete("/fluxer/:id", removeFluxerAdminIdHandler);

export default router;
