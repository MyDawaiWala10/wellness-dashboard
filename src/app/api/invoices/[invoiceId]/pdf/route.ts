import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";

/**
 * The invoice PDF, passed straight through from the backend, which builds it
 * fresh on every request. Nothing is stored, so there's no public link to it;
 * the backend checks the signed-in user's role.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  try {
    const res = await fetchWithAuth(`${base_url}/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return Response.json(
        { message: (body as { message?: string }).message ?? "Couldn't make the invoice PDF" },
        { status: res.status },
      );
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename="${invoiceId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ message: "Network error, please try again" }, { status: 502 });
  }
}
