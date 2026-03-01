// This interface describes the shape of every card object in cards.json.
// TypeScript uses this to catch mistakes — if you typo "card.naem"
// instead of "card.name", it'll warn you at compile time.

export interface Card {
  id: string
  name: string
  cost: number
  type: 'leader' | 'character' | 'event'
  rarity: 'l' | 'r' | 'uc' | 'c' | 'sr'
  color: string               // e.g. "red", "red/green"
  trigger: boolean
  images: {
    small: string             // URL to thumbnail image
    large: string             // URL to full-size image
  }
  attribute: string           // e.g. "Slash", "Ranged", "Strike"
  power: number              // e.g. 5000, 0 if none
  counter: number            // e.g. 1000, 2000, 0 if none
  family: string             // e.g. "Land of Wano/Kouzuki Clan"
}
