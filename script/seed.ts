import { storage } from "../server/storage";
import { hashPassword } from "../server/routes";
import { insertUserSchema } from "@shared/schema";

async function seed() {
  const existingUser = await storage.getUserByUsername("admin");
  if (!existingUser) {
    console.log("Seeding admin user...");
    const hashedPassword = await hashPassword("password123");
    
    const adminUser = {
      username: "admin",
      password: hashedPassword,
      schoolName: "ISOP Academy",
      address: "123 Education Lane, Learning City",
      secRegNo: "SEC123456",
      tin: "123-456-789",
      fiscalPeriod: "01/01",
      contactNo: "+1234567890",
      email: "admin@isop.edu",
      website: "https://isop.edu",
      logoUrl: "https://placehold.co/400",
    };

    // Validate with schema just to be sure, though we are bypassing API
    const parsed = insertUserSchema.parse({ ...adminUser, password: "password123" });
    
    // Create with hashed password
    await storage.createUser({ ...parsed, password: hashedPassword });
    console.log("Admin user seeded successfully!");
  } else {
    console.log("Admin user already exists.");
  }
}

seed().catch((err) => {
  console.error("Error seeding database:", err);
  process.exit(1);
});
