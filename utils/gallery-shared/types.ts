export interface VirtualArtwork {
  id: string
  title: string
  note: string
  image: string
  images: string[]
  ath: number
  atv: number
}

export interface VirtualScene {
  id: string
  name: string
  number: string
  initialHlookat: number
  initialVlookat: number
  panorama: string
  artworks: VirtualArtwork[]
  navigationAnchors: { id: string; targetId: string; label: string; ath: number; atv: number; distance: number }[]
}

export interface GalleryGroup {
  groupNumber: string
  groupCount: number
  totalScenes: number
  packageName: string
  rangeLabel: string
  previousUrl: string | null
  nextUrl: string | null
  nextPackageName: string | null
  exhibition: { title: string; time: string; intro: string }
  scenes: VirtualScene[]
  allScenes: { id: string; number: string; name: string; packageName: string; localIndex: number; url: string }[]
}
