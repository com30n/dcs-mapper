import { comboId, comboText, inputLabel, isAxisKey } from '../../dcs/combos'
import type { Combo, Command, Kind } from '../../dcs/types'
import { useWords } from '../../i18n/i18n'
import { freeUi, listen, removeCombo, toggleAdding } from '../../state/bindings'
import { deviceLabel } from '../../state/lookup'
import { cancel, useMapUi } from '../../state/mapUi'
import { modifierNames, openMods, removeModifier } from '../../state/modifiers'
import { comboIssue, commandsUsing, modifierOn, uiCombos } from '../../state/problems'
import { setupOf, type SessionState } from '../../state/session'
import type { Entry } from '../../state/types'
import { Button, Chip, Chips } from '../../ui/Button'
import { cx } from '../../ui/cx'
import styles from './Fields.module.css'

function IssueBox({ s, entry, command, kind, combo }: { s: SessionState; entry: Entry; command: Command; kind: Kind; combo: Combo }) {
  const { t, tr, trUi } = useWords()
  const issue = comboIssue(s, entry, combo, command.hash)
  if (!issue) return null
  const name = tr(command.name)
  const input = inputLabel(combo.key)
  const about = issue.code === 'uiLayer' ? trUi(issue.name) : 'name' in issue ? issue.name : ''
  const ui = 'ui' in issue ? issue : null
  const move = <Button key="move" small onClick={() => listen(command.hash, kind, name)}>{t('fix.move')}</Button>
  const remove = <Button key="remove" small onClick={() => removeCombo(kind, command.hash, comboId(combo), name)}>{t('fix.remove')}</Button>
  const free = ui && <Button key="free" small onClick={() => freeUi(ui.owner.uid, comboId(ui.ui.combo))}>{t('fix.freeUi')}</Button>
  const stop = <Button key="stop" small onClick={() => removeModifier(about)}>{t('fix.stopModifier', { input })}</Button>
  const create = <Button key="create" small onClick={() => openMods({ adding: 'modifier', name: about })}>{t('fix.createModifier', { name: about })}</Button>
  const fixes = {
    dead: [move, remove],
    modifierKey: [move, stop, remove],
    uiLayer: [move, free, remove],
    unknownModifier: [create, move, remove],
    modifierUi: [free, remove],
  }[issue.code]
  const text = t(`why.${issue.code}`, { input, name: about, combo: comboText(combo), ui: ui ? trUi(ui.ui.name) : '' })
  return (
    <div className={styles.issue} role="alert">
      <strong>{t('why.title', { command: name })}</strong><span>{text}</span>
      <span className={styles.issueFix}>{t('why.fix')}</span>
      <div className="row">{fixes}</div>
    </div>
  )
}

export function StatusCard({ s, entry }: { s: SessionState; entry: Entry }) {
  const { t, tr, trUi } = useWords()
  const { listening, adding, addAxis, focus, explain } = useMapUi()
  const modifiers = setupOf(s).modifiers ?? {}
  if (listening?.carry) {
    return (
      <div className={cx(styles.status, styles.listening)} role="status">
        <span className="eyebrow">{t(listening.carry.mode === 'move' ? 'map.carryMove' : 'map.carryCopy')}</span>
        <strong>{listening.name} · {comboText(listening.carry.combo)}</strong>
        <span className={styles.listenText}>{t('map.carryText')}</span>
        <Button variant="ghost" small onClick={cancel}>{t('map.cancel')}</Button>
      </div>
    )
  }
  if (listening) {
    const axis = listening.kind === 'axis'
    const here = axis ? (entry.wanted![listening.kind][listening.hash] ?? []).map(comboText).join(', ') : ''
    return (
      <div className={cx(styles.status, styles.listening)} role="status">
        <span className="eyebrow">{t(axis ? 'map.waitingAxis' : 'map.waitingButton')}</span>
        <strong>{listening.name}</strong>
        <span className={styles.listenText}>{t(axis ? 'map.moveAxisNow' : 'map.pressButtonNow')}</span>
        <div className={styles.pickMods}>
          <span>{t('map.modsForBinding')}</span>
          <Chips>
            {modifierNames(modifiers).map((name) => (
              <Chip key={name} look="onDark" pressed={adding.includes(name)} onClick={() => toggleAdding(name)}
                title={modifiers[name].device === 'Keyboard' ? t('mods.keyboard') : `${deviceLabel(s, modifiers[name].device)} · ${inputLabel(modifiers[name].key)}`}>{name}</Chip>
            ))}
            <Chip look="dashed" onClick={() => openMods({ adding: 'modifier' })}>{t('map.newModifier')}</Chip>
          </Chips>
          <span className="mono">{t('map.willBe', { combo: [...adding, t(axis ? 'map.theAxis' : 'map.theButton')].join(' + ') })}</span>
        </div>
        {here && (
          <div className={cx(styles.pickMods, styles.axisChoice)}>
            <Chips>
              <Chip look="onDark" pressed={!addAxis} onClick={() => useMapUi.setState({ addAxis: false })}>{t('map.replaceAxis', { input: here })}</Chip>
              <Chip look="onDark" pressed={addAxis} onClick={() => useMapUi.setState({ addAxis: true })}>{t('map.addAxis')}</Chip>
            </Chips>
            <span>{t(addAxis ? 'map.addAxisHint' : 'map.replaceAxisHint', { input: here })}</span>
          </div>
        )}
        <Button variant="ghost" small onClick={cancel}>{t('map.cancel')}</Button>
      </div>
    )
  }
  if (!focus) return null
  const using = commandsUsing(s, entry, focus)
  if (using.length && !explain) return null
  const modifier = modifierOn(s, entry, focus)
  const ui = uiCombos(s, entry).filter((u) => u.combo.key === focus && !u.combo.reformers)
  const lines = [
    ...using.map((u, i) => <li key={`u${i}`}>{tr(u.command.name)}{u.combo.reformers && <> <span className="mono muted">({comboText(u.combo)})</span></>}</li>),
    ...ui.map((u, i) => <li key={`ui${i}`}>{t('map.uiUses', { name: trUi(u.name) })}</li>),
  ]
  if (ui.length && !using.some((u) => !u.combo.reformers?.length)) {
    const example = `${modifierNames(modifiers)[0] ?? 'LAlt'} + ${inputLabel(focus)}`
    lines.push(<li key="needs" className="muted small">{t('map.uiNeedsModifier', { input: inputLabel(focus), example })}</li>)
  }
  const modifierButton = isAxisKey(focus) || !entry.dcsId ? null
    : modifier ? <Button small onClick={() => removeModifier(modifier)}>{t('map.dropModifier')}</Button>
      : <Button small onClick={() => openMods({ adding: 'modifier', device: entry.dcsId, key: focus })}>{t('map.makeModifier')}</Button>
  return (
    <div className={cx(styles.status, styles.focused)} role="status">
      <span className="eyebrow">{t('map.youPressed', { input: inputLabel(focus) })}</span>
      {modifier && <strong className={styles.modifierText}>{t('map.isModifier', { name: modifier })}</strong>}
      {lines.length ? <ul className="plain">{lines}</ul> : !modifier && <strong className={styles.freeText}>{t('map.nothingYet')}</strong>}
      {using.map((u, i) => <IssueBox key={i} s={s} entry={entry} command={u.command} kind={u.kind} combo={u.combo} />)}
      <span className="muted small">{t('map.howToPut')}</span>
      <div className="row">{modifierButton}<Button variant="ghostDark" small onClick={cancel}>{t('map.close')}</Button></div>
    </div>
  )
}
