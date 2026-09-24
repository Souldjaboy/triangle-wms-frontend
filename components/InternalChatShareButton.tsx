"use client";

import {
  useEffect,
  useState,
} from "react";

export default function InternalChatShareButton() {
  const [
    visible,
    setVisible,
  ] =
    useState(false);

  useEffect(() => {
    const pathname =
      window.location.pathname;

    const logged =
      Boolean(
        localStorage.getItem(
          "business_user"
        ) ||
        localStorage.getItem(
          "user"
        ) ||
        localStorage.getItem(
          "admin_user"
        )
      );

    const product =
      document
        .documentElement
        .dataset
        .product;

    const excluded =
      pathname === "/chat" ||
      pathname.startsWith(
        "/login"
      ) ||
      pathname.startsWith(
        "/client"
      ) ||
      pathname.startsWith(
        "/register"
      );

    setVisible(
      product ===
        "triangle" &&
      logged &&
      !excluded
    );
  }, []);

  if (!visible) {
    return null;
  }

  const send = () => {
    const url =
      window.location.href;

    const title =
      document.title ||
      "Document Triangle WMS";

    window.location.href =
      `/chat?share_url=${encodeURIComponent(
        url
      )}` +
      `&share_title=${encodeURIComponent(
        title
      )}`;
  };

  return (
    <button
      type="button"
      onClick={send}
      title="Envoyer dans le chat interne"
      className="fixed bottom-40 right-6 z-[80] rounded-full bg-yellow-500 px-4 py-3 font-black text-black shadow-xl print:hidden"
    >
      💬 Envoyer dans le chat
    </button>
  );
}
