import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { PLAN_PRICES } from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import pgSession from "connect-pg-simple";
import pg from "pg";
import multer from "multer";
import path from "path";
import nodemailer from "nodemailer";
import fs from "fs";
import { log } from "./index";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `photo_${Date.now()}_${randomBytes(4).toString("hex")}${ext}`);
  },
});
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

async function ensureSchema() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'`
    );
    if (check.rows.length === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN role text DEFAULT 'school'`);
      log("Added missing 'role' column to users table");
    }
  } catch (err) {
    log("Schema check error (non-fatal): " + (err as Error).message);
  } finally {
    await pool.end();
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.set("trust proxy", 1);

  await ensureSchema();

  const PgStore = pgSession(session);
  const sessionPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "secret",
      resave: false,
      saveUninitialized: false,
      store: new PgStore({
        pool: sessionPool,
        createTableIfMissing: true,
        tableName: "user_sessions",
      }),
      proxy: true,
      cookie: {
        secure: process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production",
        sameSite: "lax",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/uploads/:filename", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }
    res.sendFile(filePath);
  });

  app.post("/api/upload/photo", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }, upload.single("photo"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  app.post("/api/upload/photo-base64", express.json({ limit: "10mb" }), (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { image } = req.body;
    if (!image || typeof image !== "string") {
      return res.status(400).json({ message: "No image data provided" });
    }
    const match = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: "Invalid image format" });
    }
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "Image too large (max 10MB)" });
    }
    const filename = `photo_${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/uploads/${filename}` });
  });

  const pdfUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".pdf";
        cb(null, `doc_${Date.now()}_${randomBytes(4).toString("hex")}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "application/pdf") cb(null, true);
      else cb(new Error("Only PDF files allowed"));
    },
  });

  app.post("/api/upload/pdf", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }, pdfUpload.single("document"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    log(`Serializing user id=${user.id}`, "auth");
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        log(`Deserialize failed: no user found for id=${id}`, "auth");
      }
      done(null, user);
    } catch (err) {
      log(`Deserialize error for id=${id}: ${err}`, "auth");
      done(err);
    }
  });

  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(input.username);
      
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const rawPassword = input.password;
      const hashedPassword = await hashPassword(rawPassword);
      const user = await storage.createUser({
        ...input,
        password: hashedPassword,
        plaintextPassword: rawPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      next(err);
    }
  });

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      log(`GET /api/user 401 - session=${req.sessionID ? 'exists' : 'none'}, user=${req.user ? 'yes' : 'no'}`, "auth");
      return res.status(401).json({ message: "Unauthorized" });
    }
    log(`GET /api/user 200 - user id=${(req.user as any).id}`, "auth");
    res.json(req.user);
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const userId = (req.user as any).id;
      const schoolYear = req.query.schoolYear as string | undefined;
      
      const [enrollees, staff, fees] = await Promise.all([
        storage.listEnrollees(userId, schoolYear),
        storage.listStaffTeachers(userId),
        storage.listSchoolFees(userId, schoolYear),
      ]);

      const maleCount = enrollees.filter(e => e.sex === "Male").length;
      const femaleCount = enrollees.filter(e => e.sex === "Female").length;

      const activeStaff = staff.filter(s => s.status === "Active").length;

      let totalReceivables = 0;
      let totalCollected = 0;
      for (const enrollee of enrollees) {
        const fee = fees.find(f => f.educationalLevelId === enrollee.educationalLevelId);
        const feeAmount = fee ? parseFloat(fee.totalSchoolFees || "0") : 0;
        const collections = await storage.listCollectionsByEnrollee(userId, enrollee.id);
        const paid = collections.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0);
        totalReceivables += Math.max(0, feeAmount - paid);
        totalCollected += paid;
      }

      res.json({
        studentCount: enrollees.length,
        maleCount,
        femaleCount,
        staffCount: staff.length,
        activeStaffCount: activeStaff,
        totalReceivables: totalReceivables.toFixed(2),
        totalCollected: totalCollected.toFixed(2),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get(api.academic.listLevels.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const schoolYear = req.query.schoolYear as string | undefined;
    const levels = await storage.listEducationalLevels((req.user as any).id, schoolYear);
    res.json(levels);
  });

  app.post(api.academic.createLevel.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const input = api.academic.createLevel.input.parse({
        ...req.body,
        schoolId: (req.user as any).id,
      });
      const level = await storage.createEducationalLevel(input);
      res.status(201).json(level);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.academic.updateLevel.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getEducationalLevel(id);
      if (!existing || existing.schoolId !== (req.user as any).id) {
        return res.status(404).json({ message: "Level not found" });
      }
      const input = api.academic.updateLevel.input.parse(req.body);
      const { schoolId, ...safeUpdates } = input;
      const updated = await storage.updateEducationalLevel(id, safeUpdates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.academic.deleteLevel.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    const existing = await storage.getEducationalLevel(id);
    if (!existing || existing.schoolId !== (req.user as any).id) {
      return res.status(404).json({ message: "Level not found" });
    }
    const count = await storage.getStudentCount(id);
    if (count > 0) {
      return res.status(400).json({ message: "Cannot delete level with enrolled students" });
    }
    await storage.deleteEducationalLevel(id);
    res.sendStatus(200);
  });

  app.patch(api.academic.reorderLevels.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const updates = api.academic.reorderLevels.input.parse(req.body);
      await storage.reorderEducationalLevels((req.user as any).id, updates);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enrollees routes
  app.get(api.enrollees.list.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const schoolYear = req.query.schoolYear as string | undefined;
    const enrolleesList = await storage.listEnrollees((req.user as any).id, schoolYear);
    res.json(enrolleesList);
  });

  app.post(api.enrollees.create.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const input = api.enrollees.create.input.parse({
        ...req.body,
        schoolId: (req.user as any).id,
      });
      const level = await storage.getEducationalLevel(input.educationalLevelId);
      if (!level || level.schoolId !== (req.user as any).id) {
        return res.status(404).json({ message: "Educational level not found" });
      }
      const enrollee = await storage.createEnrollee(input);
      res.status(201).json(enrollee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.enrollees.update.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getEnrollee(id);
      if (!existing || existing.schoolId !== (req.user as any).id) {
        return res.status(404).json({ message: "Enrollee not found" });
      }
      const input = api.enrollees.update.input.parse(req.body);
      const { schoolId, ...safeUpdates } = input;
      if (safeUpdates.educationalLevelId) {
        const level = await storage.getEducationalLevel(safeUpdates.educationalLevelId);
        if (!level || level.schoolId !== (req.user as any).id) {
          return res.status(404).json({ message: "Educational level not found" });
        }
      }
      const updated = await storage.updateEnrollee(id, safeUpdates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.enrollees.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    const existing = await storage.getEnrollee(id);
    if (!existing || existing.schoolId !== (req.user as any).id) {
      return res.status(404).json({ message: "Enrollee not found" });
    }
    await storage.deleteEnrollee(id);
    res.sendStatus(200);
  });

  // School Fees routes
  app.get(api.fees.listFees.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const schoolYear = req.query.schoolYear as string | undefined;
    const fees = await storage.listSchoolFees((req.user as any).id, schoolYear);
    res.json(fees);
  });

  app.post(api.fees.upsertFee.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const input = api.fees.upsertFee.input.parse({
        ...req.body,
        schoolId: (req.user as any).id,
      });
      const level = await storage.getEducationalLevel(input.educationalLevelId);
      if (!level || level.schoolId !== (req.user as any).id) {
        return res.status(404).json({ message: "Educational level not found" });
      }
      const fee = await storage.upsertSchoolFee(input);
      res.json(fee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.fees.deleteFee.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    const existing = await storage.getSchoolFee(id);
    if (!existing || existing.schoolId !== (req.user as any).id) {
      return res.status(404).json({ message: "Fee not found" });
    }
    await storage.deleteSchoolFee(id);
    res.sendStatus(200);
  });

  // Collection routes
  app.get(api.collections.nextSiNo.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const schoolYear = req.query.schoolYear as string || "";
    const siNo = await storage.getNextSiNo((req.user as any).id, schoolYear);
    res.json({ siNo });
  });

  app.get(api.collections.list.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const schoolYear = req.query.schoolYear as string || "";
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const data = await storage.listCollections((req.user as any).id, schoolYear, dateFrom, dateTo);
    res.json(data);
  });

  app.post(api.collections.create.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const input = api.collections.create.input.parse({
        ...req.body,
        schoolId: (req.user as any).id,
      });
      const created = await storage.createCollection(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.collections.byEnrollee.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const enrolleeId = parseInt(req.params.enrolleeId);
    const data = await storage.listCollectionsByEnrollee((req.user as any).id, enrolleeId);
    res.json(data);
  });

  app.patch(api.collections.update.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    const existing = await storage.getCollection(id);
    if (!existing || existing.schoolId !== (req.user as any).id) {
      return res.status(404).json({ message: "Collection entry not found" });
    }
    try {
      const input = api.collections.update.input.parse(req.body);
      const updated = await storage.updateCollection(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.collections.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    const existing = await storage.getCollection(id);
    if (!existing || existing.schoolId !== (req.user as any).id) {
      return res.status(404).json({ message: "Collection entry not found" });
    }
    await storage.deleteCollection(id);
    res.sendStatus(200);
  });

  app.get(api.collections.paymentSummary.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const schoolYear = req.query.schoolYear as string || "";
    const data = await storage.getPaymentSummaryBySchoolYear((req.user as any).id, schoolYear);
    res.json(data);
  });

  app.post(api.soa.sendEmail.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const input = api.soa.sendEmail.input.parse(req.body);
      const enrollee = await storage.getEnrollee(input.enrolleeId);
      if (!enrollee || enrollee.schoolId !== (req.user as any).id) {
        return res.status(404).json({ message: "Student not found" });
      }

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser;

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(400).json({ message: "Email settings not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment." });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');
      if (pdfBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "PDF attachment too large (max 5MB)" });
      }

      const school = await storage.getUser((req.user as any).id);
      const schoolName = school?.schoolName || "School";

      await transporter.sendMail({
        from: `"${schoolName}" <${smtpFrom}>`,
        to: input.email,
        subject: `Statement of Account - ${input.studentName} (${input.schoolYear})`,
        html: `<p>Dear Parent/Guardian,</p>
<p>Please find attached the Statement of Account for <strong>${input.studentName}</strong> for school year <strong>${input.schoolYear}</strong>.</p>
<p>If you have any questions regarding this statement, please contact the school office.</p>
<p>Thank you,<br/>${schoolName}</p>`,
        attachments: [{
          filename: `SOA_${input.studentName.replace(/\s+/g, '_')}_${input.schoolYear}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      });

      await storage.updateEnrollee(input.enrolleeId, { lastSoaSentDate: new Date() } as any);

      res.json({ success: true, message: `SOA sent successfully to ${input.email}` });
    } catch (err: any) {
      console.error("SOA email error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: err.message || "Failed to send email" });
    }
  });

  // Staff & Teachers routes
  app.get(api.staff.list.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const data = await storage.listStaffTeachers((req.user as any).id);
    res.json(data);
  });

  app.post(api.staff.create.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const input = api.staff.create.input.parse({
        ...req.body,
        schoolId: (req.user as any).id,
      });
      const created = await storage.createStaffTeacher(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.staff.update.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getStaffTeacher(id);
      if (!existing || existing.schoolId !== (req.user as any).id) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      const input = api.staff.update.input.parse(req.body);
      const { schoolId, ...safeUpdates } = input;
      const updated = await storage.updateStaffTeacher(id, safeUpdates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.staff.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    const existing = await storage.getStaffTeacher(id);
    if (!existing || existing.schoolId !== (req.user as any).id) {
      return res.status(404).json({ message: "Staff member not found" });
    }
    await storage.deleteStaffTeacher(id);
    res.sendStatus(200);
  });

  // Advisory Mapping routes
  app.get(api.advisory.list.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const schoolYear = req.query.schoolYear as string | undefined;
    const data = await storage.listAdvisoryMappings((req.user as any).id, schoolYear);
    res.json(data);
  });

  app.post(api.advisory.upsert.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const input = api.advisory.upsert.input.parse({
        ...req.body,
        schoolId: (req.user as any).id,
      });
      const result = await storage.upsertAdvisoryMapping(input);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.advisory.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    const existing = await storage.getAdvisoryMapping(id);
    if (!existing || existing.schoolId !== (req.user as any).id) {
      return res.status(404).json({ message: "Advisory mapping not found" });
    }
    await storage.deleteAdvisoryMapping(id);
    res.sendStatus(200);
  });

  app.patch(api.user.update.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const input = api.user.update.input.parse(req.body);
      const updatedUser = await storage.updateUser((req.user as any).id, input);
      res.json(updatedUser);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.forgotPassword.getQuestion.path, async (req, res) => {
    try {
      const { username } = api.forgotPassword.getQuestion.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || !user.securityQuestion) {
        return res.status(404).json({ message: "User not found or no security question set. Please contact the administrator." });
      }
      res.json({ question: user.securityQuestion });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.forgotPassword.reset.path, async (req, res) => {
    try {
      const input = api.forgotPassword.reset.input.parse(req.body);
      const user = await storage.getUserByUsername(input.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.securityQuestion || !user.securityAnswer) {
        return res.status(400).json({ message: "No security question set. Please contact the administrator." });
      }
      if (user.securityAnswer.toLowerCase().trim() !== input.securityAnswer.toLowerCase().trim()) {
        return res.status(400).json({ message: "Incorrect security answer" });
      }
      const hashedPassword = await hashPassword(input.newPassword);
      await storage.updateUser(user.id, { password: hashedPassword, plaintextPassword: input.newPassword } as any);
      res.json({ message: "Password reset successfully. You can now sign in with your new password." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const isAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if ((req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  };

  app.get(api.admin.listUsers.path, isAdmin, async (_req, res) => {
    const allUsers = await storage.listAllUsers();
    res.json(allUsers);
  });

  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUser(id);
      if (!existing) {
        return res.status(404).json({ message: "User not found" });
      }
      const updates = req.body;
      const updated = await storage.updateUser(id, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { newPassword } = api.admin.resetPassword.input.parse(req.body);
      const existing = await storage.getUser(id);
      if (!existing) {
        return res.status(404).json({ message: "User not found" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(id, { password: hashedPassword, plaintextPassword: newPassword } as any);
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.admin.subscriptionSummary.path, isAdmin, async (_req, res) => {
    const allUsers = await storage.listAllUsers();
    const monthlyData: Record<string, { schools: { schoolName: string; planType: string; amount: number; paidDate: string | null }[]; total: number }> = {};
    
    for (const user of allUsers) {
      if (user.planPaidDate && user.planType && user.planType !== "Free Trial") {
        const date = new Date(user.planPaidDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { schools: [], total: 0 };
        }
        const amount = PLAN_PRICES[user.planType] || 0;
        const finalAmount = user.planAnnual ? amount * 12 * 0.9 : amount;
        monthlyData[monthKey].schools.push({
          schoolName: user.schoolName,
          planType: user.planType,
          amount: finalAmount,
          paidDate: user.planPaidDate,
        });
        monthlyData[monthKey].total += finalAmount;
      }
    }

    const summary = Object.entries(monthlyData)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => ({
        month,
        schools: data.schools,
        total: data.total,
      }));

    res.json(summary);
  });

  await seedAdminUser();

  return httpServer;
}

async function seedAdminUser() {
  const existing = await storage.getUserByUsername("IPYXadmin");
  if (!existing) {
    const hashedPassword = await hashPassword("JesusismyGod");
    await storage.createUser({
      username: "IPYXadmin",
      password: hashedPassword,
      role: "admin",
      schoolName: "ISOP Administration",
      address: "System",
      contactNo: "N/A",
      email: "admin@isop.system",
    });
    log("Admin user IPYXadmin created", "seed");
  }
}
