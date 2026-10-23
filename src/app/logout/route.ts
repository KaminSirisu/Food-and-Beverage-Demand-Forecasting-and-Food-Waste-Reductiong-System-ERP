// GET /logout — clears the session cookie, then goes to /login.
// getCurrentUser() sends a valid-cookie-but-deleted-user here, because pages can't delete cookies
// (prevents the /login ⇄ / redirect loop). The Header's logout button uses the server action instead.
import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/auth/session";

export async function GET() {
  await deleteSession();
  redirect("/login");
}