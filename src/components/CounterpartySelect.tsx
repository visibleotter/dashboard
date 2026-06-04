import { useEffect, useState } from "react";
import { createCounterparty, listCounterparties } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { ALL_COUNTERPARTY_KINDS, counterpartyKindLabel } from "@/lib/labels";
import type { Counterparty, CounterpartyKind } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/* Counterparty picker: choose an existing one, or add a new one inline. */
export function CounterpartySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t, tl } = useI18n();
  const [list, setList] = useState<Counterparty[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CounterpartyKind>("supplier");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCounterparties().then(setList).catch((e) => setError(e.message));
  }, []);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createCounterparty({ name: name.trim(), kind });
      setList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id);
      setName("");
      setKind("supplier");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="counterparty">{t("counterparty.label")}</Label>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? t("common.cancel") : t("counterparty.new")}
        </button>
      </div>

      {!adding && (
        <Select
          id="counterparty"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{t("counterparty.none")}</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({tl(counterpartyKindLabel[c.kind])})
            </option>
          ))}
        </Select>
      )}

      {adding && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
          <Input
            placeholder={t("counterparty.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select value={kind} onChange={(e) => setKind(e.target.value as CounterpartyKind)}>
            {ALL_COUNTERPARTY_KINDS.map((k) => (
              <option key={k} value={k}>
                {tl(counterpartyKindLabel[k])}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !name.trim()}>
              {saving ? t("common.saving") : t("common.add")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
