import { mysqlTable, mysqlSchema, AnyMySqlColumn, serial, text, varchar, int, boolean, timestamp, json } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const modules = mysqlTable("modules", {
  id: varchar("id", { length: 50 }).primaryKey(),
  number: int("number").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("image_url", { length: 255 }).notNull(),
  progress: int("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
});

export const sections = mysqlTable("sections", {
  id: varchar("id", { length: 50 }).primaryKey(),
  moduleId: varchar("module_id", { length: 50 }).notNull().references(() => modules.id),
  type: varchar("type", { length: 50, enum: ["diagnostic", "presentation", "infographic", "data", "evaluation"] }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  pdfUrl: varchar("pdf_url", { length: 255 }),
  order: int("order").notNull(),
  completed: boolean("completed").notNull().default(false),
});

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
});

export const updateModuleProgressSchema = z.object({
  progress: z.number().min(0).max(100),
});

export const markModuleCompleteSchema = z.object({
  completed: z.boolean(),
});

export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;
export type UpdateModuleProgress = z.infer<typeof updateModuleProgressSchema>;
export type MarkModuleComplete = z.infer<typeof markModuleCompleteSchema>;

// Tablas de exámenes
export const exams = mysqlTable("exams", {
  id: varchar("id", { length: 50 }).primaryKey(),
  sectionId: varchar("section_id", { length: 50 }).notNull().references(() => sections.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  requiresPayment: boolean("requires_payment").notNull().default(false),
  paymentAmount: int("payment_amount").notNull().default(1000),
  paymentLink: varchar("payment_link", { length: 500 }),
});

export const examQuestions = mysqlTable("exam_questions", {
  id: varchar("id", { length: 80 }).primaryKey(),
  examId: varchar("exam_id", { length: 50 }).notNull().references(() => exams.id, { onDelete: "cascade" }),
  questionNumber: int("question_number").notNull(),
  questionText: text("question_text").notNull(),
});

export const examQuestionOptions = mysqlTable("exam_question_options", {
  id: varchar("id", { length: 90 }).primaryKey(),
  questionId: varchar("question_id", { length: 80 }).notNull().references(() => examQuestions.id, { onDelete: "cascade" }),
  optionLabel: varchar("option_label", { length: 1 }).notNull(),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
});

export type Exam = typeof exams.$inferSelect;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type ExamQuestionOption = typeof examQuestionOptions.$inferSelect;

export interface ExamWithQuestions extends Exam {
  // Identificador del intento (set aleatorio de preguntas)
  attemptId?: string;
  questions: (ExamQuestion & { options: ExamQuestionOption[] })[];
}

export interface ExamSubmission {
  examId: string;
  attemptId: string;
  answers: Record<string, string>; // questionId -> optionId
}

export interface ExamResult {
  totalQuestions: number;
  correctAnswers: number;
  score: number; // percentage
  passed: boolean;
  answers: {
    questionId: string;
    selectedOptionId: string;
    correctOptionId: string;
    isCorrect: boolean;
  }[];
}

// --- Gantt Schema Removed ---

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 20, enum: ["admin", "user"] }).default("user"),
});

export const moduleProgress = mysqlTable("module_progress", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id", { length: 50 }).notNull().references(() => modules.id, { onDelete: "cascade" }),
  progress: int("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const sectionProgress = mysqlTable("section_progress", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sectionId: varchar("section_id", { length: 50 }).notNull().references(() => sections.id, { onDelete: "cascade" }),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const moduleFiles = mysqlTable("module_files", {
  id: int("id").primaryKey().autoincrement(),
  moduleId: varchar("module_id", { length: 50 }).notNull().references(() => modules.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  filePath: varchar("file_path", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileSize: int("file_size").default(0),
  previewImagePath: varchar("preview_image_path", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ModuleFile = typeof moduleFiles.$inferSelect;
export type InsertModuleFile = typeof moduleFiles.$inferInsert;

export const examAccessPermissions = mysqlTable("exam_access_permissions", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  examId: varchar("exam_id", { length: 50 }).notNull().references(() => exams.id, { onDelete: "cascade" }),
  grantedBy: int("granted_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
});

export const userPayments = mysqlTable("user_payments", {
  id: varchar("id", { length: 50 }).primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id", { length: 50 }).notNull(),
  amount: int("amount").notNull().default(1000),
  status: varchar("status", { length: 20, enum: ["pending", "completed", "failed"] }).default("pending"),
  approvedBy: int("approved_by"),
  approvedAt: timestamp("approved_at"),
  adminNotes: text("admin_notes"),
  examId: varchar("exam_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type ExamAccessPermission = typeof examAccessPermissions.$inferSelect;
export type UserPayment = typeof userPayments.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ModuleProgress = typeof moduleProgress.$inferSelect;
export type SectionProgress = typeof sectionProgress.$inferSelect;
