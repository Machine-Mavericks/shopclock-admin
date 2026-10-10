import { Router } from "express";
import { createStudent, getStudentById, punch, getSessions, newCredential } from "./clock.controller";
import { requireBearerToken } from "../auth";

const router = Router();

// Rotating phone QR:
//  { "code": "shopclock:<credential-id>:<8-digit-totp>"}
//
// Printed/static QR
//  { "code": "shopclock-static:<static-secret>"}
router.post("/punch", punch);

// Every route below requires "Authorization: Bearer <API_BEARER_TOKEN>".
router.use(requireBearerToken);

// Body: { "fullName": "Liam Pilson", "credentialType": "static" | "rotating" }
// credentialType defaults to static. The generated secret is returned once.
router.post("/createstudent", createStudent);
// Body: { "id": <student-id>, "credentialType": "static" | "rotating" }
// Revokes the student's existing credential(s) of that type and issues a new one.
router.post("/newcredential", newCredential);
router.get("/getstudent/id/:id", getStudentById);
//router.get("/getstudent/secret/:secret", getStudentBySecret);
router.get("/getsessions/:id", getSessions);

export default router;