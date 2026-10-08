import { inputLabel } from '../../dcs/combos'
import { useWords } from '../../i18n/i18n'
import { find, press } from '../../state/bindings'
import { useMapUi } from '../../state/mapUi'
import { offer } from '../../ui/offer'

export function useMarkMenu() {
  const { t } = useWords()
  return (input: string) => offer(() => {
    const listening = useMapUi.getState().listening
    return [listening
      ? { label: t('menu.assignHere', { input: inputLabel(input), command: listening.name }), run: () => press(input) }
      : { label: t('menu.find'), run: () => find(input) }]
  })
}
