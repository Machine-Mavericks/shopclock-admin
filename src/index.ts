import { ADMIN_FRONTEND_URL, LOGGER, PORT, VERSION } from "./constants";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import clockRouter from "./punch/clock.routes"
import adminAuthRouter from "./admin/admin-auth.routes";
import adminStudentsRouter from "./admin/admin-students.routes";
import adminAttendanceRouter from "./admin/admin-attendance.routes";
import adminAdminsRouter from "./admin/admin-admins.routes";
import { getStudent, initDatabase, verifyConnection } from "./database";

const app = express();

app.use(express.json());
app.use(cookieParser());

// different endpoints
app.use("/clock", cors(), clockRouter);

const adminCors = cors({ origin: ADMIN_FRONTEND_URL, credentials: true });
app.use("/admin", adminCors);
app.use("/admin/auth", adminAuthRouter);
app.use("/admin/students", adminStudentsRouter);
app.use("/admin/attendance", adminAttendanceRouter);
app.use("/admin/admins", adminAdminsRouter);

app.get("/", async (req, res) => {
  res.status(200).send(`Version: ${VERSION}`);
});

app.listen(PORT, async () => {
  LOGGER.info("express is listening");
})

verifyConnection();
initDatabase();