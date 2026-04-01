import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthCard } from "../_components/auth-card";
import { SignInForm } from "./_components/sign-in-form";

export default function SignInPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      description={t("signInDescription")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="font-semibold text-primary hover:underline">
            {t("signUpLink")}
          </Link>
        </>
      }
    >
      <SignInForm />
    </AuthCard>
  );
}
