import { users, educationalLevels, enrollees, schoolFees, collections, staffTeachers, advisoryMappings, type User, type InsertUser, type EducationalLevel, type InsertEducationalLevel, type SchoolFee, type InsertSchoolFee, type Enrollee, type InsertEnrollee, type Collection, type InsertCollection, type StaffTeacher, type InsertStaffTeacher, type AdvisoryMapping, type InsertAdvisoryMapping } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, inArray, desc, gte, lte, ne } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  listAllUsers(): Promise<User[]>;
  
  listEducationalLevels(schoolId: number, schoolYear?: string): Promise<{level: EducationalLevel, studentCount: number}[]>;
  reorderEducationalLevels(schoolId: number, updates: { id: number; order: number }[]): Promise<void>;
  getEducationalLevel(id: number): Promise<EducationalLevel | undefined>;
  createEducationalLevel(level: InsertEducationalLevel): Promise<EducationalLevel>;
  updateEducationalLevel(id: number, updates: Partial<InsertEducationalLevel>): Promise<EducationalLevel>;
  deleteEducationalLevel(id: number): Promise<void>;
  getStudentCount(levelId: number): Promise<number>;

  listEnrollees(schoolId: number, schoolYear?: string): Promise<Enrollee[]>;
  getEnrollee(id: number): Promise<Enrollee | undefined>;
  createEnrollee(enrollee: InsertEnrollee): Promise<Enrollee>;
  updateEnrollee(id: number, updates: Partial<InsertEnrollee>): Promise<Enrollee>;
  deleteEnrollee(id: number): Promise<void>;

  listSchoolFees(schoolId: number, schoolYear?: string): Promise<SchoolFee[]>;
  getSchoolFee(id: number): Promise<SchoolFee | undefined>;
  getSchoolFeeByLevelId(educationalLevelId: number): Promise<SchoolFee | undefined>;
  upsertSchoolFee(fee: InsertSchoolFee): Promise<SchoolFee>;
  deleteSchoolFee(id: number): Promise<void>;

  listCollections(schoolId: number, schoolYear: string, dateFrom?: string, dateTo?: string): Promise<Collection[]>;
  listCollectionsByEnrollee(schoolId: number, enrolleeId: number): Promise<Collection[]>;
  getPaymentSummaryBySchoolYear(schoolId: number, schoolYear: string): Promise<{ enrolleeId: number; totalPaid: string }[]>;
  getCollection(id: number): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: number, updates: Partial<InsertCollection>): Promise<Collection>;
  deleteCollection(id: number): Promise<void>;
  getNextSiNo(schoolId: number, schoolYear: string): Promise<string>;

  listStaffTeachers(schoolId: number): Promise<StaffTeacher[]>;
  getStaffTeacher(id: number): Promise<StaffTeacher | undefined>;
  createStaffTeacher(staff: InsertStaffTeacher): Promise<StaffTeacher>;
  updateStaffTeacher(id: number, updates: Partial<InsertStaffTeacher>): Promise<StaffTeacher>;
  deleteStaffTeacher(id: number): Promise<void>;

  listAdvisoryMappings(schoolId: number, schoolYear?: string): Promise<AdvisoryMapping[]>;
  getAdvisoryMapping(id: number): Promise<AdvisoryMapping | undefined>;
  getAdvisoryMappingByLevelSection(schoolId: number, schoolYear: string, educationalLevelId: number, section: string): Promise<AdvisoryMapping | undefined>;
  upsertAdvisoryMapping(mapping: InsertAdvisoryMapping): Promise<AdvisoryMapping>;
  deleteAdvisoryMapping(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async listAllUsers(): Promise<User[]> {
    return db.select().from(users).where(ne(users.role, "admin")).orderBy(users.schoolName);
  }

  async listEducationalLevels(schoolId: number, schoolYear?: string): Promise<{level: EducationalLevel, studentCount: number}[]> {
    let conditions = [eq(educationalLevels.schoolId, schoolId)];
    if (schoolYear) {
      conditions.push(eq(educationalLevels.schoolYear, schoolYear));
    }
    const levels = await db.select().from(educationalLevels)
      .where(and(...conditions))
      .orderBy(educationalLevels.order, educationalLevels.id);
    const results = await Promise.all(levels.map(async (level) => {
      const count = await this.getStudentCount(level.id);
      return { level, studentCount: count };
    }));
    return results;
  }

  async reorderEducationalLevels(schoolId: number, updates: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(educationalLevels)
          .set({ order: update.order })
          .where(and(eq(educationalLevels.id, update.id), eq(educationalLevels.schoolId, schoolId)));
      }
    });
  }

  async getEducationalLevel(id: number): Promise<EducationalLevel | undefined> {
    const [level] = await db.select().from(educationalLevels).where(eq(educationalLevels.id, id));
    return level;
  }

  async createEducationalLevel(level: InsertEducationalLevel): Promise<EducationalLevel> {
    const [created] = await db.insert(educationalLevels).values(level as any).returning();
    return created;
  }

  async updateEducationalLevel(id: number, updates: Partial<InsertEducationalLevel>): Promise<EducationalLevel> {
    const [updated] = await db.update(educationalLevels).set(updates as any).where(eq(educationalLevels.id, id)).returning();
    return updated;
  }

  async deleteEducationalLevel(id: number): Promise<void> {
    await db.delete(educationalLevels).where(eq(educationalLevels.id, id));
  }

  async getStudentCount(levelId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(enrollees).where(and(eq(enrollees.educationalLevelId, levelId)));
    return Number(result.count);
  }

  async listEnrollees(schoolId: number, schoolYear?: string): Promise<Enrollee[]> {
    let conditions = [eq(enrollees.schoolId, schoolId)];
    if (schoolYear) {
      conditions.push(eq(enrollees.schoolYear, schoolYear));
    }
    return db.select().from(enrollees).where(and(...conditions)).orderBy(desc(enrollees.enrollmentDate));
  }

  async getEnrollee(id: number): Promise<Enrollee | undefined> {
    const [enrollee] = await db.select().from(enrollees).where(eq(enrollees.id, id));
    return enrollee;
  }

  async createEnrollee(enrollee: InsertEnrollee): Promise<Enrollee> {
    const [created] = await db.insert(enrollees).values(enrollee as any).returning();
    return created;
  }

  async updateEnrollee(id: number, updates: Partial<InsertEnrollee>): Promise<Enrollee> {
    const [updated] = await db.update(enrollees).set(updates as any).where(eq(enrollees.id, id)).returning();
    return updated;
  }

  async deleteEnrollee(id: number): Promise<void> {
    await db.delete(enrollees).where(eq(enrollees.id, id));
  }

  async listSchoolFees(schoolId: number, schoolYear?: string): Promise<SchoolFee[]> {
    if (schoolYear) {
      const levels = await db.select({ id: educationalLevels.id })
        .from(educationalLevels)
        .where(and(eq(educationalLevels.schoolId, schoolId), eq(educationalLevels.schoolYear, schoolYear)));
      if (levels.length === 0) return [];
      const levelIds = levels.map(l => l.id);
      return db.select().from(schoolFees).where(
        and(eq(schoolFees.schoolId, schoolId), inArray(schoolFees.educationalLevelId, levelIds))
      );
    }
    return db.select().from(schoolFees).where(eq(schoolFees.schoolId, schoolId));
  }

  async getSchoolFee(id: number): Promise<SchoolFee | undefined> {
    const [fee] = await db.select().from(schoolFees).where(eq(schoolFees.id, id));
    return fee;
  }

  async getSchoolFeeByLevelId(educationalLevelId: number): Promise<SchoolFee | undefined> {
    const [fee] = await db.select().from(schoolFees).where(eq(schoolFees.educationalLevelId, educationalLevelId));
    return fee;
  }

  async getSchoolFeeByLevelAndTerm(educationalLevelId: number, yearLevel?: string | null, semester?: string | null): Promise<SchoolFee | undefined> {
    let conditions = [eq(schoolFees.educationalLevelId, educationalLevelId)];
    if (yearLevel) {
      conditions.push(eq(schoolFees.yearLevel, yearLevel));
    }
    if (semester) {
      conditions.push(eq(schoolFees.semester, semester));
    }
    const [fee] = await db.select().from(schoolFees).where(and(...conditions));
    return fee;
  }

  async upsertSchoolFee(fee: InsertSchoolFee): Promise<SchoolFee> {
    const existing = fee.yearLevel || fee.semester
      ? await this.getSchoolFeeByLevelAndTerm(fee.educationalLevelId, fee.yearLevel, fee.semester)
      : await this.getSchoolFeeByLevelId(fee.educationalLevelId);
    if (existing) {
      const [updated] = await db.update(schoolFees).set(fee as any).where(eq(schoolFees.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(schoolFees).values(fee as any).returning();
    return created;
  }

  async deleteSchoolFee(id: number): Promise<void> {
    await db.delete(schoolFees).where(eq(schoolFees.id, id));
  }

  async listCollections(schoolId: number, schoolYear: string, dateFrom?: string, dateTo?: string): Promise<Collection[]> {
    let conditions = [eq(collections.schoolId, schoolId), eq(collections.schoolYear, schoolYear)];
    if (dateFrom) conditions.push(gte(collections.date, dateFrom));
    if (dateTo) conditions.push(lte(collections.date, dateTo));
    return db.select().from(collections).where(and(...conditions)).orderBy(desc(collections.date), collections.siNo);
  }

  async listCollectionsByEnrollee(schoolId: number, enrolleeId: number): Promise<Collection[]> {
    return db.select().from(collections)
      .where(and(eq(collections.schoolId, schoolId), eq(collections.enrolleeId, enrolleeId)))
      .orderBy(desc(collections.date), desc(collections.siNo));
  }

  async getPaymentSummaryBySchoolYear(schoolId: number, schoolYear: string): Promise<{ enrolleeId: number; totalPaid: string }[]> {
    const results = await db.select({
      enrolleeId: collections.enrolleeId,
      totalPaid: sql<string>`COALESCE(SUM(${collections.amount}), 0)::text`,
    })
    .from(collections)
    .where(and(eq(collections.schoolId, schoolId), eq(collections.schoolYear, schoolYear)))
    .groupBy(collections.enrolleeId);
    return results.filter(r => r.enrolleeId !== null) as { enrolleeId: number; totalPaid: string }[];
  }

  async getCollection(id: number): Promise<Collection | undefined> {
    const [item] = await db.select().from(collections).where(eq(collections.id, id));
    return item;
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [created] = await db.insert(collections).values(collection as any).returning();
    return created;
  }

  async updateCollection(id: number, updates: Partial<InsertCollection>): Promise<Collection> {
    const [updated] = await db.update(collections).set(updates as any).where(eq(collections.id, id)).returning();
    return updated;
  }

  async deleteCollection(id: number): Promise<void> {
    await db.delete(collections).where(eq(collections.id, id));
  }

  async getNextSiNo(schoolId: number, schoolYear: string): Promise<string> {
    const [result] = await db.select({ maxSi: sql<string>`MAX(si_no)` })
      .from(collections)
      .where(and(eq(collections.schoolId, schoolId), eq(collections.schoolYear, schoolYear)));
    if (!result?.maxSi) return "0001";
    const num = parseInt(result.maxSi, 10);
    return String(num + 1).padStart(4, "0");
  }

  async listStaffTeachers(schoolId: number): Promise<StaffTeacher[]> {
    return db.select().from(staffTeachers).where(eq(staffTeachers.schoolId, schoolId)).orderBy(staffTeachers.lastName);
  }

  async getStaffTeacher(id: number): Promise<StaffTeacher | undefined> {
    const [staff] = await db.select().from(staffTeachers).where(eq(staffTeachers.id, id));
    return staff;
  }

  async createStaffTeacher(staff: InsertStaffTeacher): Promise<StaffTeacher> {
    const [created] = await db.insert(staffTeachers).values(staff as any).returning();
    return created;
  }

  async updateStaffTeacher(id: number, updates: Partial<InsertStaffTeacher>): Promise<StaffTeacher> {
    const [updated] = await db.update(staffTeachers).set(updates as any).where(eq(staffTeachers.id, id)).returning();
    return updated;
  }

  async deleteStaffTeacher(id: number): Promise<void> {
    await db.delete(staffTeachers).where(eq(staffTeachers.id, id));
  }

  async listAdvisoryMappings(schoolId: number, schoolYear?: string): Promise<AdvisoryMapping[]> {
    let conditions = [eq(advisoryMappings.schoolId, schoolId)];
    if (schoolYear) conditions.push(eq(advisoryMappings.schoolYear, schoolYear));
    return db.select().from(advisoryMappings).where(and(...conditions));
  }

  async getAdvisoryMapping(id: number): Promise<AdvisoryMapping | undefined> {
    const [mapping] = await db.select().from(advisoryMappings).where(eq(advisoryMappings.id, id));
    return mapping;
  }

  async getAdvisoryMappingByLevelSection(schoolId: number, schoolYear: string, educationalLevelId: number, section: string): Promise<AdvisoryMapping | undefined> {
    const [mapping] = await db.select().from(advisoryMappings).where(
      and(
        eq(advisoryMappings.schoolId, schoolId),
        eq(advisoryMappings.schoolYear, schoolYear),
        eq(advisoryMappings.educationalLevelId, educationalLevelId),
        eq(advisoryMappings.section, section)
      )
    );
    return mapping;
  }

  async upsertAdvisoryMapping(mapping: InsertAdvisoryMapping): Promise<AdvisoryMapping> {
    const existing = await this.getAdvisoryMappingByLevelSection(
      mapping.schoolId, mapping.schoolYear, mapping.educationalLevelId, mapping.section
    );
    if (existing) {
      const [updated] = await db.update(advisoryMappings).set(mapping as any).where(eq(advisoryMappings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(advisoryMappings).values(mapping as any).returning();
    return created;
  }

  async deleteAdvisoryMapping(id: number): Promise<void> {
    await db.delete(advisoryMappings).where(eq(advisoryMappings.id, id));
  }
}

export const storage = new DatabaseStorage();
