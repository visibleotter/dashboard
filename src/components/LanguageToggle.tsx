import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/* Switches the whole UI between Hebrew (RTL) and English (LTR). */
export function LanguageToggle() {
  const { lang, toggle } = useI18n();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label="Toggle language"
      title={lang === "he" ? "Switch to English" : "מעבר לעברית"}
    >
      {lang === "he" ? "EN" : "עב"}
    </Button>
  );
}
