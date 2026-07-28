import type { Correction, SightProfile } from '../core/types'
import { turnsFor } from '../data/defaultProfiles'
import { ReflexSightArt } from './sightArt/ReflexSightArt'
import { IronSightArt } from './sightArt/IronSightArt'

/**
 * Realistic illustration of the selected sight with the active adjusters
 * highlighted: an amber rotation arc shows which way to turn (from the
 * profile's turn semantics), a green arrow shows where the impact moves,
 * and the click count is labeled in Hebrew.
 */
export function SightDiagram({
  profile,
  correction,
}: {
  profile: SightProfile
  correction: Correction
}): JSX.Element {
  const turns = turnsFor(profile)
  const elevation = {
    clicks: correction.elevation.clicks,
    direction: correction.elevation.direction,
    turn:
      correction.elevation.direction === 'none'
        ? ('cw' as const)
        : turns[correction.elevation.direction],
  }
  const windage = {
    clicks: correction.windage.clicks,
    direction: correction.windage.direction,
    turn:
      correction.windage.direction === 'none'
        ? ('cw' as const)
        : turns[correction.windage.direction],
  }
  return profile.kind === 'reflex' ? (
    <ReflexSightArt elevation={elevation} windage={windage} />
  ) : (
    <IronSightArt elevation={elevation} windage={windage} />
  )
}
