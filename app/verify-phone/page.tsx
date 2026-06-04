import { Suspense } from "react";
import VerifyCodeForm from "../../components/VerifyCodeForm";
import WhatsAppSupportButton from "../../components/WhatsAppSupportButton";

export default function VerifyPhonePage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-3xl bg-white p-8 shadow-2xl">
          <Suspense fallback={<div className="font-bold">Chargement...</div>}>
            <VerifyCodeForm targetType="phone" />
          </Suspense>
          <div className="mt-5">
            <WhatsAppSupportButton className="w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
