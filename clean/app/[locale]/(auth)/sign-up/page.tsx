import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthCard } from "../_components/auth-card";
import { SignUpForm } from "./_components/sign-up-form";

export default function SignUpPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      description={t("signUpDescription")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            {t("signInLink")}
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
