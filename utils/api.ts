/**
 * API 兼容入口 — re-export from data/api
 * 仅供 pages/ 等目录引用，data/ 目录内部请直接 import './api'
 */
export { fetchExhibitions, fetchArtworks, fetchPrograms, fetchNews, submitBooking } from '../data/api'
export type { ExhibitionDTO, ExhibitionArtworkDTO, ArtworkDTO, ProgramDTO, NewsDTO } from '../data/api'
