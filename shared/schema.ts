import { pgTable, text, serial, timestamp, integer, boolean, jsonb, numeric, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userSessions = pgTable("user_sessions", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const PLAN_TYPES = ["Free Trial", "Regular Subscription", "Online Enrollment", "Full Accounting"] as const;

export const PLAN_PRICES: Record<string, number> = {
  "Free Trial": 0,
  "Regular Subscription": 3500,
  "Online Enrollment": 3500,
  "Full Accounting": 6000,
};

export const PLAN_PAYMENT_LINKS: Record<string, string> = {
  "Regular Subscription": "https://paymongo.page/l/integratedschooloperationportal-subscription-payment",
  "Online Enrollment": "https://paymongo.page/l/integratedschooloperationportal-adds-on-online-enrollment",
  "Full Accounting": "https://paymongo.page/l/integratedschooloperationportal-full-accounting-plan",
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("school"),
  schoolName: text("school_name").notNull(),
  address: text("address").notNull(),
  secRegNo: text("sec_reg_no"),
  tin: text("tin"),
  fiscalPeriod: text("fiscal_period"),
  contactNo: text("contact_no").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  logoUrl: text("logo_url"),
  planType: text("plan_type").default("Free Trial"),
  planExpiry: text("plan_expiry"),
  planPaidDate: text("plan_paid_date"),
  planRemarks: text("plan_remarks"),
  planAnnual: boolean("plan_annual").default(false),
  onlineEnrollmentActive: boolean("online_enrollment_active").default(false),
  onlineEnrollmentExpiry: text("online_enrollment_expiry"),
  securityQuestion: text("security_question"),
  securityAnswer: text("security_answer"),
  plaintextPassword: text("plaintext_password"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const educationalLevels = pgTable("educational_levels", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  schoolYear: text("school_year").notNull(),
  parentLevel: text("parent_level").notNull(),
  childLevel: text("child_level").notNull(),
  grandchildLevel: text("grandchild_level"),
  yearLevel: text("year_level"), // Added field
  parentLevelOther: text("parent_level_other"),
  childLevelOther: text("child_level_other"),
  grandchildLevelOther: text("grandchild_level_other"),
  sections: jsonb("sections").$type<string[]>().default([]),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const enrollees = pgTable("enrollees", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  schoolYear: text("school_year").notNull(),
  educationalLevelId: integer("educational_level_id").notNull(),
  section: text("section"),
  idNo: text("id_no"),

  psaBirthCertNo: text("psa_birth_cert_no"),
  lrn: text("lrn"),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  nameExtension: text("name_extension"),
  sex: text("sex").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  age: integer("age"),
  isIndigenous: boolean("is_indigenous").default(false),
  indigenousGroup: text("indigenous_group"),

  civilStatus: text("civil_status"),
  nationality: text("nationality"),
  studentEmail: text("student_email"),
  mobileNo: text("mobile_no"),
  emergencyContact: text("emergency_contact"),
  emergencyContactNo: text("emergency_contact_no"),

  regionCode: text("region_code"),
  regionName: text("region_name"),
  provinceCode: text("province_code"),
  provinceName: text("province_name"),
  cityCode: text("city_code"),
  cityName: text("city_name"),
  barangayCode: text("barangay_code"),
  barangayName: text("barangay_name"),
  zipCode: text("zip_code"),

  fatherName: text("father_name"),
  motherMaidenName: text("mother_maiden_name"),
  guardianName: text("guardian_name"),
  parentGuardianTel: text("parent_guardian_tel"),

  enrollmentStatus: text("enrollment_status").default("New"),
  lastGradeLevel: text("last_grade_level"),
  lastSchoolYear: text("last_school_year"),
  lastSchoolName: text("last_school_name"),
  lastSchoolId: text("last_school_id"),
  lastSchoolAddress: text("last_school_address"),

  shsTrack: text("shs_track"),
  shsStrand: text("shs_strand"),

  yearLevel: text("year_level"),
  semester: text("semester"),
  courseProgram: text("course_program"),
  major: text("major"),

  documentChecklist: jsonb("document_checklist").$type<string[]>().default([]),
  subjectCodes: jsonb("subject_codes").$type<SubjectEntry[]>().default([]),
  totalUnits: integer("total_units"),

  photoUrl: text("photo_url"),
  pdfAttachments: jsonb("pdf_attachments").$type<string[]>().default([]),

  backAccounts: numeric("back_accounts", { precision: 12, scale: 2 }).default("0"),
  otherFees: jsonb("other_fees").$type<MiscFeeItem[]>().default([]),
  discounts: jsonb("discounts").$type<MiscFeeItem[]>().default([]),
  scholarships: jsonb("scholarships").$type<MiscFeeItem[]>().default([]),
  totalApplicableFees: numeric("total_applicable_fees", { precision: 12, scale: 2 }).default("0"),

  enrollmentDate: timestamp("enrollment_date").defaultNow(),
  lastSoaSentDate: timestamp("last_soa_sent_date"),
});

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  schoolYear: text("school_year").notNull(),
  date: text("date").notNull(),
  siNo: text("si_no").notNull(),
  enrolleeId: integer("enrollee_id"),
  name: text("name").notNull(),
  collectionCategory: text("collection_category").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()).transform(v => String(v)),
});

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;

export const subjectEntrySchema = z.object({
  code: z.string(),
  description: z.string().optional(),
  units: z.number().min(0).optional(),
});

export type SubjectEntry = z.infer<typeof subjectEntrySchema>;

export const miscFeeItemSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
});

export type MiscFeeItem = z.infer<typeof miscFeeItemSchema>;

export const schoolFees = pgTable("school_fees", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  educationalLevelId: integer("educational_level_id").notNull(),
  yearLevel: text("year_level"),
  semester: text("semester"),
  entranceFee: numeric("entrance_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  tuitionFee: numeric("tuition_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  miscellaneousFees: jsonb("miscellaneous_fees").$type<MiscFeeItem[]>().default([]),
  totalMiscFees: numeric("total_misc_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSchoolFees: numeric("total_school_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSchoolFeeSchema = createInsertSchema(schoolFees).omit({
  id: true,
  createdAt: true,
}).extend({
  entranceFee: z.string().or(z.number()).transform(v => String(v)),
  tuitionFee: z.string().or(z.number()).transform(v => String(v)),
  totalMiscFees: z.string().or(z.number()).transform(v => String(v)),
  totalSchoolFees: z.string().or(z.number()).transform(v => String(v)),
  miscellaneousFees: z.array(miscFeeItemSchema).default([]),
  yearLevel: z.string().nullable().optional(),
  semester: z.string().nullable().optional(),
});

export type SchoolFee = typeof schoolFees.$inferSelect;
export type InsertSchoolFee = z.infer<typeof insertSchoolFeeSchema>;

export const insertEnrolleeSchema = createInsertSchema(enrollees).omit({
  id: true,
  enrollmentDate: true,
}).extend({
  backAccounts: z.string().or(z.number()).transform(v => String(v)).optional(),
  totalApplicableFees: z.string().or(z.number()).transform(v => String(v)).optional(),
  otherFees: z.array(miscFeeItemSchema).default([]),
  discounts: z.array(miscFeeItemSchema).default([]),
  scholarships: z.array(miscFeeItemSchema).default([]),
  documentChecklist: z.array(z.string()).default([]),
  subjectCodes: z.array(subjectEntrySchema).default([]),
  pdfAttachments: z.array(z.string()).default([]),
  totalUnits: z.number().nullable().optional(),
});

export type Enrollee = typeof enrollees.$inferSelect;
export type InsertEnrollee = z.infer<typeof insertEnrolleeSchema>;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  fiscalPeriod: z.string().regex(/^\d{2}\/\d{2}$/, "Format must be MM/DD").optional().nullable(),
  role: z.string().optional(),
  planType: z.string().optional(),
  planExpiry: z.string().nullable().optional(),
  planPaidDate: z.string().nullable().optional(),
  planRemarks: z.string().nullable().optional(),
  planAnnual: z.boolean().optional(),
  onlineEnrollmentActive: z.boolean().optional(),
  onlineEnrollmentExpiry: z.string().nullable().optional(),
  securityQuestion: z.string().nullable().optional(),
  securityAnswer: z.string().nullable().optional(),
  plaintextPassword: z.string().nullable().optional(),
});

export const updateUserProfileSchema = insertUserSchema.omit({ password: true }).partial();

export const forgotPasswordSchema = z.object({
  username: z.string().min(1, "Username is required"),
  securityAnswer: z.string().min(1, "Security answer is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertEducationalLevelSchema = createInsertSchema(educationalLevels).omit({
  id: true,
  createdAt: true
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type EducationalLevel = typeof educationalLevels.$inferSelect;
export type InsertEducationalLevel = z.infer<typeof insertEducationalLevelSchema>;

export const HIGHER_ED_LEVELS = ["TVET", "Tertiary", "Professional Degree", "Graduate Education"];
export const BASIC_ED_LEVELS = ["Pre-School", "Primary", "Junior High", "Senior High"];

export const STAFF_STATUSES = ["Active", "AWOL", "Retired", "Resigned", "On Leave", "Fired"] as const;
export const EMPLOYMENT_STATUSES = ["Regular", "Probationary", "Part-time", "Guest Lecturer"] as const;

export const facultyLoadSchema = z.object({
  subjectCode: z.string(),
  subjectName: z.string().optional(),
  units: z.number().min(0).optional(),
});

export type FacultyLoadEntry = z.infer<typeof facultyLoadSchema>;

export const staffTeachers = pgTable("staff_teachers", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  employeeId: text("employee_id"),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  gender: text("gender").notNull(),
  contactNumber: text("contact_number"),
  email: text("email"),
  employmentStatus: text("employment_status"),
  dateOfHire: text("date_of_hire"),
  highestEducationalAttainment: text("highest_educational_attainment"),
  status: text("status").default("Active"),
  photoUrl: text("photo_url"),

  designatedGradeLevel: text("designated_grade_level"),
  sectionAssigned: text("section_assigned"),
  isClassAdviser: boolean("is_class_adviser").default(false),
  subjectSpecialization: text("subject_specialization"),
  roomAssignment: text("room_assignment"),

  department: text("department"),
  academicRank: text("academic_rank"),
  prcLicenseNo: text("prc_license_no"),
  facultyLoad: jsonb("faculty_load").$type<FacultyLoadEntry[]>().default([]),
  researchSpecialization: text("research_specialization"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStaffTeacherSchema = createInsertSchema(staffTeachers).omit({
  id: true,
  createdAt: true,
}).extend({
  facultyLoad: z.array(facultyLoadSchema).default([]),
});

export type StaffTeacher = typeof staffTeachers.$inferSelect;
export type InsertStaffTeacher = z.infer<typeof insertStaffTeacherSchema>;

export const advisoryMappings = pgTable("advisory_mappings", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  schoolYear: text("school_year").notNull(),
  educationalLevelId: integer("educational_level_id").notNull(),
  section: text("section").notNull(),
  adviserId: integer("adviser_id"),
  studentIds: jsonb("student_ids").$type<number[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdvisoryMappingSchema = createInsertSchema(advisoryMappings).omit({
  id: true,
  createdAt: true,
}).extend({
  studentIds: z.array(z.number()).default([]),
  adviserId: z.number().nullable().optional(),
});

export type AdvisoryMapping = typeof advisoryMappings.$inferSelect;
export type InsertAdvisoryMapping = z.infer<typeof insertAdvisoryMappingSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
