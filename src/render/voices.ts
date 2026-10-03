import { species } from '../content/species';
import type { VoiceKind } from '../platform/audio';
import type { Creature } from '../core/types';

/** Which voice a creature has, from what kind of creature it is. */
export function voiceOf(c: Pick<Creature, 'species'>): VoiceKind {
  const sp = species(c.species);
  const t = sp.traits;
  if (t.includes('Dragon')) return 'roar';
  if (t.includes('Spirit')) return 'chime';
  if (t.includes('Amphibian')) return 'croak';
  if (t.includes('Bird')) return 'tweet';
  if (t.includes('Fish')) return 'bloop';
  if (t.includes('Insect')) return 'buzz';
  if (t.includes('Arachnid')) return 'click';
  if (t.includes('Reptile')) return 'hiss';
  if (t.includes('Primate')) return 'ooh';
  if (t.includes('Fungus')) return 'pop';
  if (t.includes('Mammal')) return sp.rarity === 'common' ? 'squeak' : 'purr';
  return 'squeak';
}
