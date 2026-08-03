"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Camera, ClipboardList, ImagePlus, Loader2, Minus, Plus, Save, Trash2 } from "lucide-react"
import { getUserId } from "@/lib/current-user"

interface CashRegisterField {
  id: string
  label: string
  fieldType: string
  isRequired: boolean
  orderIndex: number
  allowPhoto?: boolean
}

interface ExtraInfoPanelProps {
  period: "matin" | "aprem" | "journee"
  gymId?: string
  gymName?: string
  userEmail: string
  userName: string
}

const INFOS_TAG = "[INFOS PENDANT]"

/**
 * Vue dédiée aux "Informations supplémentaires" (champs personnalisés de la
 * caisse) : l'employé peut les remplir/modifier indépendamment du comptage de
 * caisse pendant sa période de travail.
 */
export function ExtraInfoPanel({ period, gymId, gymName, userEmail, userName }: ExtraInfoPanelProps) {
  const [fields, setFields] = useState<CashRegisterField[]>([])
  const [values, setValues] = useState<Record<string, any>>({})
  // Dernières valeurs enregistrées, pour repérer une éventuelle baisse (un champ numérique
  // ne devrait normalement jamais diminuer, sauf erreur de saisie de l'employé).
  const [initialValues, setInitialValues] = useState<Record<string, any>>({})
  const [photos, setPhotos] = useState<Record<string, string[]>>({}) // fieldId -> filenames
  // Dernières photos enregistrées, pour détecter un ajout/retrait de photo non sauvegardé.
  const [initialPhotos, setInitialPhotos] = useState<Record<string, string[]>>({})
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  // Charge les définitions de champs + dernières valeurs saisies aujourd'hui.
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Définitions des champs
      let url = `/api/db/cash-register-fields?period=${period}`
      if (gymId) url += `&gym_id=${gymId}`
      const defsRes = await fetch(url, { credentials: "same-origin" })
      const defsJson = defsRes.ok ? await defsRes.json() : { data: [] }
      const defs: CashRegisterField[] = Array.isArray(defsJson.data) ? defsJson.data : []
      setFields(defs)

      // 2. Dernières valeurs sauvegardées aujourd'hui (entrées taggées [INFOS PENDANT])
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      const params = new URLSearchParams({ month })
      if (gymId) params.set("gym_id", gymId)
      const entriesRes = await fetch(`/api/db/cash-register-entries?${params.toString()}`, { credentials: "same-origin" })
      const entriesJson = entriesRes.ok ? await entriesRes.json() : { data: [] }
      const all: any[] = Array.isArray(entriesJson.data) ? entriesJson.data : []
      const todayStr = now.toISOString().split("T")[0]
      const mine = all.filter((e) =>
        e.user_email === userEmail
        && e.period === period
        && (e.entry_date || "").startsWith(todayStr)
        && typeof e.notes === "string"
        && e.notes.includes(INFOS_TAG)
      )

      const initial: Record<string, any> = {}
      const initialPhotos: Record<string, string[]> = {}
      defs.forEach((f) => { initial[f.id] = f.fieldType === "checkbox" ? false : "" })

      if (mine.length > 0) {
        const latest = mine[mine.length - 1]
        const custom = (latest.custom_values || {}) as Record<string, any>
        Object.entries(custom).forEach(([k, v]) => {
          if (k.startsWith("__photos:")) {
            const fid = k.slice("__photos:".length)
            const arr = Array.isArray(v) ? v.map(String).filter(Boolean) : []
            initialPhotos[fid] = [...(initialPhotos[fid] || []), ...arr]
          } else if (k.startsWith("__photo:")) {
            // Rétro-compatibilité : ancienne clé mono-photo
            const fid = k.slice("__photo:".length)
            if (v) initialPhotos[fid] = [...(initialPhotos[fid] || []), String(v)]
          } else if (k !== "__coinCounts" && !k.startsWith("__") && k in initial) {
            initial[k] = v
          }
        })
        setLastSavedAt(latest.created_at)
      } else {
        setLastSavedAt(null)
      }
      setValues(initial)
      setInitialValues({ ...initial })
      setPhotos({ ...initialPhotos })
      setInitialPhotos({ ...initialPhotos })
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }, [period, gymId, userEmail])

  useEffect(() => { loadAll() }, [loadAll])

  // Une modification non enregistrée (valeur de champ ou photo ajoutée/retirée) doit être signalée
  // clairement, champ par champ, sinon l'employé peut quitter la page en pensant avoir sauvegardé
  // ou sans savoir quelle zone précise a changé.
  const dirtyFieldIds = useMemo(() => {
    const ids = new Set<string>()
    for (const f of fields) {
      const a = values[f.id]
      const b = initialValues[f.id]
      let changed: boolean
      if (f.fieldType === "checkbox") {
        changed = !!a !== !!b
      } else if (f.fieldType === "number") {
        // "" (jamais touché) et 0 représentent le même "rien de saisi" pour un compteur —
        // sinon retomber sur 0 après avoir tapé une valeur reste marqué comme non enregistré
        // alors que rien n'a réellement changé par rapport à un champ vierge.
        const an = a === "" || a === undefined || a === null ? 0 : Number(a)
        const bn = b === "" || b === undefined || b === null ? 0 : Number(b)
        changed = an !== bn
      } else {
        const an = a === undefined || a === null ? "" : a
        const bn = b === undefined || b === null ? "" : b
        changed = String(an) !== String(bn)
      }
      if (!changed && f.allowPhoto) {
        const pa = photos[f.id] || []
        const pb = initialPhotos[f.id] || []
        changed = pa.length !== pb.length || pa.some((v, i) => v !== pb[i])
      }
      if (changed) ids.add(f.id)
    }
    return ids
  }, [fields, values, initialValues, photos, initialPhotos])
  const isDirty = dirtyFieldIds.size > 0

  const updateValue = (id: string, value: any) => {
    setValues((prev) => ({ ...prev, [id]: value }))
  }

  const handleDiscard = () => {
    setValues({ ...initialValues })
    setPhotos({ ...initialPhotos })
  }

  const handlePhotoSelect = async (fieldId: string, file: File) => {
    setUploadingFieldId(fieldId)
    try {
      const fd = new FormData()
      fd.append("photo", file)
      const res = await fetch("/api/incident-photos", { method: "POST", body: fd })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Erreur lors de l'envoi de la photo")
        return
      }
      const json = await res.json()
      const filename = json?.data?.filename
      if (filename) {
        setPhotos((prev) => ({
          ...prev,
          [fieldId]: [...(prev[fieldId] || []), filename],
        }))
        toast.success("Photo ajoutée.")
      }
    } finally {
      setUploadingFieldId(null)
    }
  }

  const removePhoto = (fieldId: string, index: number) => {
    setPhotos((prev) => {
      const list = prev[fieldId] || []
      const next = list.filter((_, i) => i !== index)
      const updated = { ...prev }
      if (next.length === 0) delete updated[fieldId]
      else updated[fieldId] = next
      return updated
    })
  }

  const handleSave = async () => {
    // Validation des champs requis
    const missing = fields.filter((f) => {
      if (!f.isRequired) return false
      const v = values[f.id]
      if (f.fieldType === "checkbox") return v !== true
      return v === undefined || v === null || v === ""
    })
    if (missing.length > 0) {
      toast.error(`Champs obligatoires manquants : ${missing.map((f) => f.label).join(", ")}`)
      return
    }

    // Sanitize : pas de valeurs négatives pour les champs numériques
    const sanitized: Record<string, any> = {}
    fields.forEach((f) => {
      const raw = values[f.id]
      if (f.fieldType === "number") {
        if (raw === "" || raw === null || raw === undefined) {
          sanitized[f.id] = ""
        } else {
          const parsed = Number(raw)
          sanitized[f.id] = Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
        }
      } else if (f.fieldType === "checkbox") {
        sanitized[f.id] = !!raw
      } else {
        sanitized[f.id] = raw ?? ""
      }
    })

    setSaving(true)
    try {
      const userId = getUserId() || ""
      const payload: Record<string, any> = { ...sanitized }
      // Joindre les photos par champ (tableau)
      Object.entries(photos).forEach(([fieldId, filenames]) => {
        if (Array.isArray(filenames) && filenames.length > 0) {
          payload[`__photos:${fieldId}`] = filenames
        }
      })
      const res = await fetch("/api/db/cash-register-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-user-email": userEmail,
        },
        body: JSON.stringify({
          entryDate: new Date().toISOString(),
          period,
          gymId: gymId || null,
          userEmail,
          userName,
          totalRegister: 0,
          cashAmount: 0,
          coinsDetail: "",
          notes: INFOS_TAG,
          customValues: payload,
        }),
      })
      if (!res.ok) {
        toast.error("Impossible d'enregistrer les informations.")
        return
      }
      toast.success("Informations enregistrées.")
      await loadAll()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-base">Informations supplémentaires</h2>
          <p className="text-xs text-gray-500">{gymName ? `${gymName} · ` : ""}Période en cours</p>
        </div>
        {!loading && isDirty && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            Infos non enregistrées
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : fields.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            Aucun champ supplémentaire à renseigner pour cette période.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
            {fields.map((field) => {
              const fieldDirty = dirtyFieldIds.has(field.id)
              return (
              <div
                key={field.id}
                className={[
                  "space-y-2 rounded-lg transition-colors",
                  fieldDirty ? "p-2 -m-2 border border-amber-300 bg-amber-50" : "",
                ].join(" ")}
              >
                <Label className="text-sm font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
                  {field.label}
                  {field.isRequired && <span className="text-red-500">*</span>}
                  {fieldDirty && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-700 font-normal">
                      Non enregistré
                    </Badge>
                  )}
                </Label>
                {field.fieldType === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!values[field.id]}
                      onCheckedChange={(checked) => updateValue(field.id, checked)}
                    />
                    <span className="text-sm text-gray-600">{field.label}</span>
                  </div>
                ) : field.fieldType === "number" ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateValue(field.id, Math.max(0, (Number(values[field.id]) || 0) - 1))}
                        disabled={(Number(values[field.id]) || 0) <= 0}
                        className="w-9 h-9 flex-shrink-0 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Minus className="w-4 h-4 text-gray-700" />
                      </button>
                      <Input
                        type="number"
                        value={values[field.id] ?? ""}
                        min={0}
                        onChange={(e) => {
                          if (e.target.value === "") { updateValue(field.id, ""); return }
                          const parsed = Number(e.target.value)
                          updateValue(field.id, Number.isNaN(parsed) ? 0 : Math.max(0, parsed))
                        }}
                        placeholder={field.label}
                        className="border-2 rounded-xl bg-white text-gray-900 text-center w-24"
                      />
                      <button
                        type="button"
                        onClick={() => updateValue(field.id, (Number(values[field.id]) || 0) + 1)}
                        className="w-9 h-9 flex-shrink-0 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                    {initialValues[field.id] !== undefined
                      && initialValues[field.id] !== ""
                      && values[field.id] !== ""
                      && Number(values[field.id]) < Number(initialValues[field.id]) && (
                      <p className="text-xs text-amber-600 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        En baisse par rapport au dernier enregistrement ({initialValues[field.id]}) — vérifiez qu'il ne s'agit pas d'une erreur.
                      </p>
                    )}
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={values[field.id] ?? ""}
                    onChange={(e) => updateValue(field.id, e.target.value)}
                    placeholder={field.label}
                    className="border-2 rounded-xl bg-white text-gray-900"
                  />
                )}

                {field.allowPhoto && (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                    {(photos[field.id] || []).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(photos[field.id] || []).map((filename, idx) => (
                          <div key={`${filename}-${idx}`} className="relative group">
                            <img
                              src={`/api/incident-photos/${filename}`}
                              alt={`Photo ${idx + 1} - ${field.label}`}
                              className="rounded-lg w-full h-28 object-cover border border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(field.id, idx)}
                              className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white shadow-sm opacity-90 hover:opacity-100"
                              title="Retirer cette photo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-2 cursor-pointer hover:bg-indigo-100">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingFieldId === field.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ""
                            if (file) handlePhotoSelect(field.id, file)
                          }}
                        />
                        {uploadingFieldId === field.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        Prendre une photo
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={uploadingFieldId === field.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ""
                            if (file) handlePhotoSelect(field.id, file)
                          }}
                        />
                        <ImagePlus className="w-3.5 h-3.5" />
                        Choisir un fichier
                      </label>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500">
              {lastSavedAt
                ? `Dernier enregistrement : ${new Date(lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "Pas encore d'enregistrement aujourd'hui."}
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={saving}
                  className="border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 w-full sm:w-auto"
                >
                  Annuler les modifications
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-2">Enregistrer</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
