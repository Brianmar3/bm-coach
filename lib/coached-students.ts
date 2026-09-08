import { Prisma } from "@prisma/client";

/** Missing accountType belongs to an existing coached student, including legacy JSON. */
export const coachedStudentsWhere: Prisma.StudentRecordWhereInput = {
  OR: [
    { data: { path: ["accountType"], equals: Prisma.AnyNull } },
    { data: { path: ["accountType"], not: "SELF_SERVICE" } },
  ],
};
