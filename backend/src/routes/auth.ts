import { Elysia } from "elysia";
import { auth } from "../auth/auth";

export const authRoutes = new Elysia()
  .mount(auth.handler);
