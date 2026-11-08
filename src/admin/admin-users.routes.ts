import { Router } from "express";
import {
  createUser,
  getSessions,
  getUser,
  listUsers,
  regenerateCredential,
  setRole,
  togglePunch,
} from "./admin-users.controller";
import { requireAdminSession } from "./admin-auth.middleware";

const router = Router();

router.use(requireAdminSession);

router.get("/", listUsers);
router.post("/", createUser);
router.get("/:id", getUser);
router.post("/:id/role", setRole);
router.post("/:id/punch", togglePunch);
router.post("/:id/credential", regenerateCredential);
router.get("/:id/sessions", getSessions);

export default router;
