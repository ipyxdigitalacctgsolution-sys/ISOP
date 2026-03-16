import { z } from 'zod';
import { insertUserSchema, updateUserProfileSchema, forgotPasswordSchema, users, educationalLevels, insertEducationalLevelSchema, schoolFees, insertSchoolFeeSchema, miscFeeItemSchema, enrollees, insertEnrolleeSchema, collections, insertCollectionSchema, staffTeachers, insertStaffTeacherSchema, advisoryMappings, insertAdvisoryMappingSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login' as const,
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  user: {
    update: {
      method: 'PATCH' as const,
      path: '/api/user' as const,
      input: updateUserProfileSchema,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  forgotPassword: {
    reset: {
      method: 'POST' as const,
      path: '/api/forgot-password' as const,
      input: forgotPasswordSchema,
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    getQuestion: {
      method: 'POST' as const,
      path: '/api/forgot-password/question' as const,
      input: z.object({ username: z.string().min(1) }),
      responses: {
        200: z.object({ question: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
  admin: {
    listUsers: {
      method: 'GET' as const,
      path: '/api/admin/users' as const,
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    updateUser: {
      method: 'PATCH' as const,
      path: '/api/admin/users/:id' as const,
      input: insertUserSchema.partial(),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    resetPassword: {
      method: 'POST' as const,
      path: '/api/admin/users/:id/reset-password' as const,
      input: z.object({ newPassword: z.string().min(6) }),
      responses: {
        200: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    subscriptionSummary: {
      method: 'GET' as const,
      path: '/api/admin/subscription-summary' as const,
      responses: {
        200: z.array(z.object({
          month: z.string(),
          schools: z.array(z.object({
            schoolName: z.string(),
            planType: z.string(),
            amount: z.number(),
            paidDate: z.string().nullable(),
          })),
          total: z.number(),
        })),
        401: errorSchemas.unauthorized,
      },
    },
  },
  academic: {
    listLevels: {
      method: 'GET' as const,
      path: '/api/academic/levels' as const,
      responses: {
        200: z.array(z.object({
          level: z.custom<typeof educationalLevels.$inferSelect>(),
          studentCount: z.number()
        })),
        401: errorSchemas.unauthorized,
      },
    },
    createLevel: {
      method: 'POST' as const,
      path: '/api/academic/levels' as const,
      input: insertEducationalLevelSchema,
      responses: {
        201: z.custom<typeof educationalLevels.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    updateLevel: {
      method: 'PATCH' as const,
      path: '/api/academic/levels/:id' as const,
      input: insertEducationalLevelSchema.partial(),
      responses: {
        200: z.custom<typeof educationalLevels.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    deleteLevel: {
      method: 'DELETE' as const,
      path: '/api/academic/levels/:id' as const,
      responses: {
        200: z.void(),
        400: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    reorderLevels: {
      method: 'PATCH' as const,
      path: '/api/academic/levels/reorder' as const,
      input: z.array(z.object({ id: z.number(), order: z.number() })),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  fees: {
    listFees: {
      method: 'GET' as const,
      path: '/api/academic/fees' as const,
      responses: {
        200: z.array(z.custom<typeof schoolFees.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    upsertFee: {
      method: 'POST' as const,
      path: '/api/academic/fees' as const,
      input: insertSchoolFeeSchema,
      responses: {
        200: z.custom<typeof schoolFees.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    deleteFee: {
      method: 'DELETE' as const,
      path: '/api/academic/fees/:id' as const,
      responses: {
        200: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  enrollees: {
    list: {
      method: 'GET' as const,
      path: '/api/academic/enrollees' as const,
      responses: {
        200: z.array(z.custom<typeof enrollees.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/academic/enrollees' as const,
      input: insertEnrolleeSchema,
      responses: {
        201: z.custom<typeof enrollees.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/academic/enrollees/:id' as const,
      input: insertEnrolleeSchema.partial(),
      responses: {
        200: z.custom<typeof enrollees.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/academic/enrollees/:id' as const,
      responses: {
        200: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  collections: {
    list: {
      method: 'GET' as const,
      path: '/api/finance/collections' as const,
      responses: {
        200: z.array(z.custom<typeof collections.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/finance/collections' as const,
      input: insertCollectionSchema,
      responses: {
        201: z.custom<typeof collections.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/finance/collections/:id' as const,
      input: insertCollectionSchema.partial(),
      responses: {
        200: z.custom<typeof collections.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/finance/collections/:id' as const,
      responses: {
        200: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
    byEnrollee: {
      method: 'GET' as const,
      path: '/api/finance/collections/by-enrollee/:enrolleeId' as const,
      responses: {
        200: z.array(z.custom<typeof collections.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    nextSiNo: {
      method: 'GET' as const,
      path: '/api/finance/collections/next-si' as const,
      responses: {
        200: z.object({ siNo: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    paymentSummary: {
      method: 'GET' as const,
      path: '/api/finance/collections/payment-summary' as const,
      responses: {
        200: z.array(z.object({ enrolleeId: z.number(), totalPaid: z.string() })),
        401: errorSchemas.unauthorized,
      },
    },
  },
  soa: {
    sendEmail: {
      method: 'POST' as const,
      path: '/api/finance/send-soa' as const,
      input: z.object({
        enrolleeId: z.number(),
        email: z.string().email(),
        pdfBase64: z.string(),
        studentName: z.string(),
        schoolYear: z.string(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  staff: {
    list: {
      method: 'GET' as const,
      path: '/api/academic/staff' as const,
      responses: {
        200: z.array(z.custom<typeof staffTeachers.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/academic/staff' as const,
      input: insertStaffTeacherSchema,
      responses: {
        201: z.custom<typeof staffTeachers.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/academic/staff/:id' as const,
      input: insertStaffTeacherSchema.partial(),
      responses: {
        200: z.custom<typeof staffTeachers.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/academic/staff/:id' as const,
      responses: {
        200: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  advisory: {
    list: {
      method: 'GET' as const,
      path: '/api/academic/advisory' as const,
      responses: {
        200: z.array(z.custom<typeof advisoryMappings.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    upsert: {
      method: 'POST' as const,
      path: '/api/academic/advisory' as const,
      input: insertAdvisoryMappingSchema,
      responses: {
        200: z.custom<typeof advisoryMappings.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/academic/advisory/:id' as const,
      responses: {
        200: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type LoginInput = z.infer<typeof api.auth.login.input>;
export type RegisterInput = z.infer<typeof api.auth.register.input>;
export type UserResponse = z.infer<typeof api.auth.register.responses[201]>;
