"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ParcelCard } from "@/components/ParcelCard";
import { getParcel } from "@/lib/portfolio";
import type { ParcelRecord } from "@/lib/schemas";

export default function ParcelDetail() {
  const params = useParams<{ id: string }>();
  const [parcel, setParcel] = useState<ParcelRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setParcel(getParcel(params.id));
    setReady(true);
  }, [params.id]);

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#17211c]">
      <div className="mx-auto max-w-3xl px-5 py-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between border-b border-[#17211c]/15 pb-4">
          <Link href="/" className="text-sm font-semibold text-[#2f6b4f] hover:underline">← Portfolio</Link>
          <span className="text-sm font-semibold tracking-[0.22em] uppercase text-[#526058]">ParcelLens</span>
        </header>

        {!ready ? null : parcel ? (
          <ParcelCard parcel={parcel} />
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-[#17211c]/15 py-16 text-center text-sm text-[#8a9389]">
            <div>
              <p className="font-medium text-[#526058]">Parcel not found in this browser.</p>
              <p className="mt-2">Portfolios live in local storage. <Link href="/" className="text-[#2f6b4f] hover:underline">Return to the portfolio</Link> and upload or import documents.</p>
            </div>
          </div>
        )}

        <footer className="mt-8 border-t border-[#17211c]/15 pt-4 text-xs text-[#68766b]">
          Screening tool — not a legal title opinion. Cost rates as configured; verify at the SRO.
        </footer>
      </div>
    </main>
  );
}
