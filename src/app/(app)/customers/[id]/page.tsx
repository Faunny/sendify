import Link from "next/link";
import { ArrowLeft, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";

export default async function CustomerDetail() {
  // Customer detail will render the real customer timeline (orders + sends + opens + clicks +
  // cart abandons + push) once the DB is connected and Shopify customers are synced in.
  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
        <Link href="/customers"><ArrowLeft className="h-3.5 w-3.5" /> Customers</Link>
      </Button>
      <EmptyState
        icon={<UserX className="h-5 w-5" />}
        title="Cliente no encontrado"
        description="Este cliente no existe en la base de datos. Cuando los clientes se importen o se sincronicen desde Shopify aparecerán aquí con su timeline completo."
        primaryAction={{ label: "Volver a Customers", href: "/customers" }}
      />
    </div>
  );
}
