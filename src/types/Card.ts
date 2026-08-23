// This interface describes the shape of every card object in cards.json.
// TypeScript uses this to catch mistakes — if you typo "card.naem"
// instead of "card.name", it'll warn you at compile time.

export interface Card {
  id: string
  name: string
  cost: number                // for leaders this is Life, not cost
  type: 'leader' | 'character' | 'event' | 'stage'
  rarity: 'l' | 'r' | 'uc' | 'c' | 'sr' | 'tr' | 'sec' | 'sp card' | 'p'
  color: string               // e.g. "red", "red/green"
  trigger: boolean
  images: {
    small: string             // URL to thumbnail image
    large: string             // URL to full-size image
  }
  attribute: string           // e.g. "Slash", "Ranged", "Strike", "Wisdom"
  power: number              // e.g. 5000, 0 if none
  counter: number            // e.g. 1000, 2000, 0 if none
  family: string             // e.g. "Land of Wano/Kouzuki Clan"
  ability: string            // card effect/ability text
  set: string                // product this print came from, e.g. "OP17", "ST31"
}
