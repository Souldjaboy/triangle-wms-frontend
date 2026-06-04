"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../app/lib/api";

type Props = {
  className?: string;
  label?: string;
};

export default function WhatsAppSupportButton({
  className = "",
  label = "Contacter support WhatsApp",
}: Props) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch(apiUrl("/support/config"))
      .then((response) => response.json())
      .then((data) => {
        if (mounted) setUrl(data?.whatsapp_url || "");
      })
      .catch(() => {
        if (mounted) setUrl("");
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!url) {
    return (
      <a
        href="/support"
        className={`inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-bold text-white ${className}`}
      >
        {label}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-bold text-white ${className}`}
    >
      {label}
    </a>
  );
}
