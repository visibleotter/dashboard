import { useEffect, useState } from "react";
import { createPerson, listPeople } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import type { Person } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/* Assignee picker: choose an existing person, or add one inline. Mirrors CounterpartySelect. */
export function PersonSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const [list, setList] = useState<Person[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPeople().then(setList).catch((e) => setError(e.message));
  }, []);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createPerson({ name: name.trim(), role: role.trim() || null });
      setList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id);
      setName("");
      setRole("");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="grid gap-2 rounded-md border bg-muted/30 p-2">
        <Input placeholder={t("people.name")} value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder={t("people.role")} value={role} onChange={(e) => setRole(e.target.value)} />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !name.trim()}>
            {saving ? t("common.saving") : t("common.add")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
            {t("common.cancel")}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t("people.none")}</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.role ? ` (${p.role})` : ""}
          </option>
        ))}
      </Select>
      <button type="button" className="whitespace-nowrap text-xs text-primary hover:underline" onClick={() => setAdding(true)}>
        {t("people.new")}
      </button>
    </div>
  );
}
