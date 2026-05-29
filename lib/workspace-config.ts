import { prisma } from "@/lib/prisma";
import { DEFAULT_NO_HIRE_REASONS } from "@/types";

export async function ensureDefaultWorkspaceDropdownOptions(
  workspaceId: string,
) {
  await prisma.$transaction(
    DEFAULT_NO_HIRE_REASONS.map((name) =>
      prisma.workspaceDropdownOption.upsert({
        where: {
          workspaceId_type_name: {
            workspaceId,
            type: "NO_HIRE_REASON",
            name,
          },
        },
        update: {},
        create: {
          workspaceId,
          type: "NO_HIRE_REASON",
          name,
          description: null,
        },
      }),
    ),
  );
}
