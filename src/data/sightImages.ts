import type { SightProfile } from '../core/types'

/**
 * Real sight photos live in public/sights/ under these exact names —
 * replace the shipped placeholders with actual photos to upgrade the app.
 */
const IMAGE_BY_PROFILE_ID: Record<string, string> = {
  'mepro-reflex': 'M5.jpg',
  'mepro-21': 'M21.jpg',
  'm16a2-iron': 'M16.jpg',
  'm4-iron': 'M4.jpg',
  'tavor-iron': 'TAVOR.jpg',
}

export function sightImageUrl(profile: SightProfile): string {
  const file =
    IMAGE_BY_PROFILE_ID[profile.id] ?? (profile.kind === 'reflex' ? 'M5.jpg' : 'M16.jpg')
  return `${import.meta.env.BASE_URL}sights/${file}`
}
