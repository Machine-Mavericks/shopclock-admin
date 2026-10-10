import { Router } from "express";
import {
  createStudent,
  getSessions,
  getStudent,
  listStudents,
  regenerateCredential,
} from "./admin-students.controller";
import { requireAdminSession } from "./admin-auth.middleware";

const router = Router();

router.use(requireAdminSession);

router.get("/", listStudents);
router.post("/", createStudent);
router.get("/:id", getStudent);
router.post("/:id/credential", regenerateCredential);
router.get("/:id/sessions", getSessions);

export default router;
