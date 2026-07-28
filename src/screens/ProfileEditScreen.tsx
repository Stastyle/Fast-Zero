import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { he } from '../i18n/he'
import { useProfilesStore } from '../state/profilesStore'
import { StepHeader } from '../components/StepHeader'
import type { SightKind, SightProfile } from '../core/types'

const BLANK: Omit<SightProfile, 'id'> = {
  name: '',
  kind: 'reflex',
  builtIn: false,
  elevationCmPerClick: 0.7,
  windageCmPerClick: 0.7,
  instructions: {
    up: 'סובב את בורג הגובה למעלה',
    down: 'סובב את בורג הגובה למטה',
    left: 'סובב את בורג הצד שמאלה',
    right: 'סובב את בורג הצד ימינה',
  },
  desiredImpactOffsetCm: { right: 0, up: 0 },
}

/** Built-in profiles are read-only: show every setting, allow none to change. */
function ProfileViewScreen({ profile }: { profile: SightProfile }) {
  const rows: Array<[string, string]> = [
    [he.profiles.name, profile.name],
    [he.profiles.kind, profile.kind === 'reflex' ? he.profiles.reflex : he.profiles.iron],
    [he.profiles.elevationCmPerClick, `${profile.elevationCmPerClick} ס״מ`],
    [he.profiles.windageCmPerClick, `${profile.windageCmPerClick} ס״מ`],
    [he.profiles.desiredOffsetUp, `${profile.desiredImpactOffsetCm.up} ס״מ`],
    [he.profiles.instrUp, profile.instructions.up],
    [he.profiles.instrDown, profile.instructions.down],
    [he.profiles.instrLeft, profile.instructions.left],
    [he.profiles.instrRight, profile.instructions.right],
  ]
  return (
    <div className="screen">
      <StepHeader title={he.profiles.viewTitle} backTo="/profiles" />
      <div className="screen-body">
        <p className="hint">{he.profiles.builtInReadOnly}</p>
        {profile.notes && (
          <div className="card" style={{ fontWeight: 700 }}>
            {profile.notes}
          </div>
        )}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(([label, value]) => (
            <div key={label}>
              <div className="hint">{label}</div>
              <div style={{ fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProfileEditScreen() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { profiles, updateProfile, addProfile, deleteProfile } = useProfilesStore()
  const existing = id ? profiles.find((p) => p.id === id) : undefined
  const isNew = !existing

  const [form, setForm] = useState(() => {
    const src = existing ?? BLANK
    return {
      name: src.name,
      kind: src.kind,
      elevationCmPerClick: String(src.elevationCmPerClick),
      windageCmPerClick: String(src.windageCmPerClick),
      desiredUp: String(src.desiredImpactOffsetCm.up),
      instrUp: src.instructions.up,
      instrDown: src.instructions.down,
      instrLeft: src.instructions.left,
      instrRight: src.instructions.right,
    }
  })

  if (existing?.builtIn) return <ProfileViewScreen profile={existing} />

  const elevation = parseFloat(form.elevationCmPerClick)
  const windage = parseFloat(form.windageCmPerClick)
  const desiredUp = parseFloat(form.desiredUp)
  const valid =
    form.name.trim() !== '' &&
    elevation > 0 &&
    windage > 0 &&
    Number.isFinite(elevation) &&
    Number.isFinite(windage) &&
    Number.isFinite(desiredUp)

  const save = () => {
    const patch = {
      name: form.name.trim(),
      kind: form.kind,
      elevationCmPerClick: elevation,
      windageCmPerClick: windage,
      desiredImpactOffsetCm: { right: 0, up: desiredUp },
      instructions: {
        up: form.instrUp,
        down: form.instrDown,
        left: form.instrLeft,
        right: form.instrRight,
      },
    }
    if (isNew) {
      addProfile({ ...BLANK, ...patch, id: `custom-${Date.now()}` })
    } else {
      updateProfile(existing.id, patch)
    }
    navigate('/profiles')
  }

  return (
    <div className="screen">
      <StepHeader
        title={isNew ? he.profiles.newTitle : he.profiles.editTitle}
        backTo="/profiles"
      />
      <div className="screen-body">
        <div className="field">
          <label htmlFor="pname">{he.profiles.name}</label>
          <input
            id="pname"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="pkind">{he.profiles.kind}</label>
          <select
            id="pkind"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as SightKind })}
          >
            <option value="reflex">{he.profiles.reflex}</option>
            <option value="iron">{he.profiles.iron}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pelev">{he.profiles.elevationCmPerClick}</label>
          <input
            id="pelev"
            type="number"
            inputMode="decimal"
            step="0.05"
            min="0.05"
            value={form.elevationCmPerClick}
            onChange={(e) => setForm({ ...form, elevationCmPerClick: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="pwind">{he.profiles.windageCmPerClick}</label>
          <input
            id="pwind"
            type="number"
            inputMode="decimal"
            step="0.05"
            min="0.05"
            value={form.windageCmPerClick}
            onChange={(e) => setForm({ ...form, windageCmPerClick: e.target.value })}
          />
        </div>
        <p className="hint">{he.profiles.moaHelper}</p>
        <div className="field">
          <label htmlFor="poffset">{he.profiles.desiredOffsetUp}</label>
          <input
            id="poffset"
            type="number"
            inputMode="decimal"
            step="0.5"
            value={form.desiredUp}
            onChange={(e) => setForm({ ...form, desiredUp: e.target.value })}
          />
        </div>

        <strong>{he.profiles.instructionsTitle}</strong>
        {(
          [
            ['instrUp', he.profiles.instrUp],
            ['instrDown', he.profiles.instrDown],
            ['instrLeft', he.profiles.instrLeft],
            ['instrRight', he.profiles.instrRight],
          ] as const
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <input
              id={key}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}

        <button type="button" className="big-button" disabled={!valid} onClick={save}>
          {he.profiles.save}
        </button>
        {!isNew && !existing.builtIn && (
          <button
            type="button"
            className="big-button big-button--danger"
            onClick={() => {
              deleteProfile(existing.id)
              navigate('/profiles')
            }}
          >
            {he.profiles.delete}
          </button>
        )}
      </div>
    </div>
  )
}
