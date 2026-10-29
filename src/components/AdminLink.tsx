import Link from "next/link";
import { isAdmin } from "@/modules/admin/data";

/** A link only admins see. For everyone else it renders nothing, so the admin area isn't advertised. */
export async function AdminLink({ href, label, className }: { href: string; label: string; className?: string }) {
  if (!(await isAdmin())) return null;
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
