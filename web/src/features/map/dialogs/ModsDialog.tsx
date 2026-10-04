import { dcsCompare, inputLabel, sameId } from '../../../dcs/combos'
import { useWords } from '../../../i18n/i18n'
import { deviceLabel } from '../../../state/lookup'
import { closeDialog } from '../../../state/mapUi'
import { editMods, openMods, ownerFor, ownersOf, removeModifier, renameModifier, saveModifier } from '../../../state/modifiers'
import { commandsUsing, uiCombos } from '../../../state/problems'
import { setupOf, type SessionState } from '../../../state/session'
import type { Dialog } from '../../../state/types'
import { Button } from '../../../ui/Button'
import { cx } from '../../../ui/cx'
import { Modal } from '../../../ui/Modal'
import { Alert } from '../../../ui/Notice'
import status from '../Fields.module.css'
import { Dot } from '../MapPicture'
import styles from './Dialogs.module.css'

type ModsState = Extract<Dialog, { type: 'mods' }>

function AddForm({ s, dialog }: { s: SessionState; dialog: ModsState }) {
  const { t, tr, trUi } = useWords()
  const all = setupOf(s).modifiers ?? {}
  const owner = ownerFor(s, dialog.device)
  const marks = owner ? Object.values(s.devices[owner.deviceId].pictures).flatMap((p) => (p.marks ?? []).map((m) => m.input)) : []
  const keys = [...new Set(marks.filter((k) => k.startsWith('JOY_BTN') && !k.includes('POV')))]
  const numbers = keys.length ? keys.map((k) => Number(k.slice(7))).sort((a, b) => a - b) : Array.from({ length: 128 }, (_, i) => i + 1)
  const { key } = dialog
  const name = dialog.name ?? key
  const warnings: [boolean, string][] = []
  if (key && owner) {
    const using = commandsUsing(s, owner, key).filter((u) => !u.combo.reformers)
    if (using.length) warnings.push([false, t('mods.busy', { input: inputLabel(key), command: using.map((u) => tr(u.command.name)).join('; ') })])
    const ui = uiCombos(s, owner).find((u) => u.combo.key === key && !u.combo.reformers)
    if (ui) warnings.push([false, t('mods.uiBusy', { name: trUi(ui.name), input: inputLabel(key) })])
    const twin = Object.keys(all).find((n) => sameId(all[n].device, owner.dcsId) && all[n].key === key)
    if (twin) warnings.push([true, t('mods.twin', { name: twin })])
  }
  if (key && name && all[name.trim()]) warnings.push([true, t('mods.nameTaken')])
  const blocked = !key || !owner || !name.trim() || warnings.some(([error]) => error)
  const title = t(dialog.adding === 'switch' ? 'mods.addSwitch' : 'mods.addModifier')
  return (
    <section className={styles.add}>
      <h3>{title}</h3>
      {!key && (
        <div className={cx(status.status, status.listening)} role="status">
          <span className="eyebrow">{t('map.waiting')}</span><strong>{t('mods.press')}</strong><span>{t('mods.pressHint')}</span>
        </div>
      )}
      <div className={cx('row', styles.addFields)}>
        <label className={cx(styles.fieldBlock, styles.fieldGrow)}>{t('mods.device')}
          <select className="text" value={owner?.dcsId ?? ''} onChange={(e) => editMods({ device: e.target.value, key: '', name: null })}>
            {ownersOf(s).map((e) => <option key={e.uid} value={e.dcsId}>{s.devices[e.deviceId].name}</option>)}
          </select>
        </label>
        <label className={styles.fieldBlock}>{t('mods.key')}
          <select className="text mono" value={key} onChange={(e) => editMods({ key: e.target.value, name: null })}>
            <option value="">{t('mods.pick')}</option>
            {numbers.map((n) => <option key={n} value={`JOY_BTN${n}`}>Btn {n}</option>)}
          </select>
        </label>
        <label className={cx(styles.fieldBlock, styles.fieldGrow)}>{t('mods.name')}
          <input className="text" value={name} onChange={(e) => editMods({ name: e.target.value })} />
        </label>
      </div>
      {warnings.map(([error, text]) => <Alert key={text} error={error}>{text}</Alert>)}
      <div className="row">
        <Button variant="primary" small disabled={blocked} onClick={saveModifier}>{title}</Button>
        <Button small onClick={() => editMods({ adding: null })}>{t('map.cancel')}</Button>
      </div>
    </section>
  )
}

function Columns({ s }: { s: SessionState }) {
  const { t } = useWords()
  const setup = setupOf(s)
  const all = setup.modifiers ?? {}
  const usesOf = (name: string) => setup.entries.reduce((n, e) => n + Object.values(e.wanted?.key ?? {}).flat().filter((c) => (c.reformers ?? []).includes(name)).length, 0)
  const deviceNames = Object.keys(all).filter((n) => all[n].device !== 'Keyboard').sort(dcsCompare)
  const keyboard = Object.keys(all).filter((n) => all[n].device === 'Keyboard').join(', ') || '—'
  const item = (name: string) => {
    const m = all[name]
    const uses = usesOf(name)
    return (
      <div key={name} className={styles.item}>
        <Dot kind="modifier" />
        <div className="stack">
          <input key={name} className={cx('text', styles.strong)} defaultValue={name} aria-label={t('mods.name')}
            onBlur={(e) => renameModifier(name, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          <span className="mono small">{`${deviceLabel(s, m.device)} · ${inputLabel(m.key)}`}</span>
          <span className={cx('small', uses ? 'warn-text' : 'muted')}>{uses ? t('mods.uses', { count: uses }) : t('mods.unused')}</span>
        </div>
        <Button variant="icon" aria-label={t('mods.remove', { name })} onClick={() => removeModifier(name)}>×</Button>
      </div>
    )
  }
  const column = (isSwitch: boolean) => {
    const kind = isSwitch ? 'switch' : 'modifier'
    const names = deviceNames.filter((n) => !!all[n].switch === isSwitch)
    return (
      <section className={styles.column}>
        <h3>{t(isSwitch ? 'mods.switches' : 'mods.modifiers')}</h3>
        <span className="muted small">{t(isSwitch ? 'mods.switchesHint' : 'mods.modifiersHint')}</span>
        {names.length ? names.map(item) : <p className={styles.emptyNote}>{t(isSwitch ? 'mods.noSwitches' : 'mods.noModifiers')}</p>}
        {!isSwitch && <p className="muted small">{t('mods.keyboardList', { names: keyboard })}</p>}
        <Button tone="modifier" onClick={() => openMods({ adding: kind })}>{t(isSwitch ? 'mods.addSwitch' : 'mods.addModifier')}</Button>
      </section>
    )
  }
  return <div className={styles.columns}>{column(false)}{column(true)}</div>
}

export function ModsDialog({ s, dialog }: { s: SessionState; dialog: ModsState }) {
  const { t, tr } = useWords()
  const foot = (
    <>
      <span className="muted small">{t('mods.saved', { folder: s.catalog!.folder })}</span>
      <Button variant="primary" small onClick={closeDialog}>{t('mods.done')}</Button>
    </>
  )
  return (
    <Modal eyebrow={t('mods.eyebrow', { aircraft: tr(s.catalog!.name) })} title={t('mods.title')} sub={t('mods.lead')} onClose={closeDialog} foot={foot}>
      {dialog.adding ? <AddForm s={s} dialog={dialog} /> : <Columns s={s} />}
    </Modal>
  )
}
