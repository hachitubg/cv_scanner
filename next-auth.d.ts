import "next-auth";
import "next-auth/jwt";

import type { RoleType } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: RoleType;
    };
  }

  interface User {
    role: RoleType;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: RoleType;
  }
}
