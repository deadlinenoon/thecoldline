import { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "user" | "admin" | string;
    };
  }

  interface User {
    id: string;
    role: "user" | "admin" | string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "user" | "admin" | string;
  }
}
