"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Print / "save as PDF" of the booking summary (print styles hide navigation). */
export function PrintButton() {
  return (
    <Button variant="secondary" className="w-full" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> Drucken / als PDF speichern
    </Button>
  );
}
