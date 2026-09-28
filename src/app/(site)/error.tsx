"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page grid min-h-[60vh] place-items-center pb-20 pt-36 text-center">
      <div>
        <h1 className="text-4xl">Da ist etwas schiefgelaufen.</h1>
        <p className="mt-3 text-ink-soft">Die Seite konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Erneut versuchen</Button>
          <ButtonLink href="/" variant="secondary">
            Zur Startseite
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
