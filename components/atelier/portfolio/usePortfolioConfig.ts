'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import {
  savePortfolioConfig,
  loadPortfolioConfig,
  getPortfolioConfigEtag,
  setWorkPublic,
} from '@/app/atelier/(portal)/portfolio/actions'
import { PORTFOLIO_SAVE_ERR } from '@/lib/portfolio-save-errors'
import {
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  LANDING_HERO_BEVEL_PX_DEFAULT,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_CAST_SHADOW_BLUR_DEFAULT,
  WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
} from '@/lib/works-mode-light'
import {
  type PortfolioConfig, type CollectionItem, type WorksMode, type ThemeWork,
  type PortfolioTabProps,
  DEFAULT_CONFIG, migrate, reorder,
} from '@/lib/portfolio-config-types'
import type { PdfFormat, PdfProfileSettings, PdfPurpose, PdfWorkCandidate } from '@/lib/portfolio-pdf-types'
import {
  canonicalCollectionTheme,
  normalizeTheme,
  themeWorksForCollectionLabel,
} from '@/components/public/works-utils'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ActiveSlot {
  type: 'theme'
  page: 'works' | 'sections'
  index: number
  modeIdx?: number
}

type Args = Pick<PortfolioTabProps, 'oeuvres' | 'themes' | 'themePublicStats' | 'themePrivateWorks'>

export interface UsePortfolioConfigReturn {
  config:        PortfolioConfig
  setConfig:     React.Dispatch<React.SetStateAction<PortfolioConfig>>
  loading:       boolean
  activeMode:    number
  setActiveMode: React.Dispatch<React.SetStateAction<number>>
  activeSlot:    ActiveSlot | null
  setActiveSlot: React.Dispatch<React.SetStateAction<ActiveSlot | null>>
  saveBusy:      boolean
  pdfOpen:       boolean
  setPdfOpen:    React.Dispatch<React.SetStateAction<boolean>>
  isDirty:       boolean
  savedAt:       Date | null
  storageStale:  boolean
  // Derived from themes
  themeNames:                string[]
  themeNameStats:            Record<string, { total: number; pub: number }>
  privateWorksForThemeLabel: (label: string | null | undefined) => ThemeWork[] | undefined
  worksForCollectionItem:    (item: CollectionItem) => PdfWorkCandidate[]
  // Config save handlers
  handleSave:      () => Promise<void>
  savePdfProfile:  (purpose: PdfPurpose, format: PdfFormat, settings: PdfProfileSettings) => Promise<void>
  handleTransfer:  (value: string) => void
  handleMakePublic:(oeuvreId: number) => Promise<void>
  loadData:        () => Promise<void>
  // Works-mode helpers
  updateMode:          (i: number, patch: Partial<WorksMode>) => void
  addMode:             () => void
  deleteMode:          (i: number) => void
  moveMode:            (from: number, to: number) => void
  addModeCollection:   (m: number) => void
  moveModeCollection:  (m: number, from: number, to: number) => void
  updateModeCollection:(m: number, i: number, patch: Partial<CollectionItem>) => void
  deleteModeCollection:(m: number, id: string) => void
  // Portfolio-section helpers
  addItem:       (target: 'sections' | 'works_collections') => void
  moveCollection:(target: 'sections' | 'works_collections', from: number, to: number) => void
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePortfolioConfig({
  oeuvres, themes, themePublicStats = {}, themePrivateWorks = {},
}: Args): UsePortfolioConfigReturn {
  const { t, lang } = useI18n()
  const router = useRouter()

  // ── State ────────────────────────────────────────────────────────────────

  const [config,       setConfig]       = useState<PortfolioConfig>(DEFAULT_CONFIG)
  const [loading,      setLoading]      = useState(true)
  const [activeMode,   setActiveMode]   = useState(0)
  const [activeSlot,   setActiveSlot]   = useState<ActiveSlot | null>(null)
  const [saveBusy,     setSaveBusy]     = useState(false)
  const [pdfOpen,      setPdfOpen]      = useState(false)
  const [portfolioEtag, setPortfolioEtag] = useState<string | null>(null)
  const [storageStale, setStorageStale] = useState(false)
  const [savedAt,      setSavedAt]      = useState<Date | null>(null)
  /** JSON snapshot at the last successful load or save. */
  const savedConfigRef = useRef<string>('')

  const isDirty = useMemo(
    () => savedConfigRef.current !== '' && JSON.stringify(config) !== savedConfigRef.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config],
  )

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await loadPortfolioConfig()
    if ('ok' in result) {
      const migrated = migrate(result.config)
      setConfig(migrated)
      setPortfolioEtag(result.etag)
      setStorageStale(false)
      savedConfigRef.current = JSON.stringify(migrated)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || loading) return
      const result = await getPortfolioConfigEtag()
      if ('ok' in result && result.etag !== portfolioEtag) setStorageStale(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loading, portfolioEtag])

  // ── Etag conflict ─────────────────────────────────────────────────────────

  const handlePortfolioEtagConflict = useCallback(async () => {
    if (window.confirm(t('portfolio_save_etag_conflict_confirm'))) {
      await loadData()
      alert(t('portfolio_save_etag_reloaded'))
    } else {
      alert(t('portfolio_save_etag_conflict'))
    }
  }, [loadData, t])

  // ── Save handlers ─────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaveBusy(true)
    const result = await savePortfolioConfig(config, { ifMatch: portfolioEtag })
    setSaveBusy(false)
    if ('ok' in result) {
      setPortfolioEtag(result.etag)
      setStorageStale(false)
      savedConfigRef.current = JSON.stringify(config)
      setSavedAt(new Date())
    } else if (result.error === PORTFOLIO_SAVE_ERR.ETAG_MISMATCH) {
      await handlePortfolioEtagConflict()
    } else if (result.error === PORTFOLIO_SAVE_ERR.OBJECT_EXISTS) {
      alert(t('portfolio_save_object_exists'))
    } else {
      alert(`${t('error_prefix')} ${result.error}`)
    }
  }, [config, portfolioEtag, t, handlePortfolioEtagConflict])

  const savePdfProfile = useCallback(async (purpose: PdfPurpose, format: PdfFormat, settings: PdfProfileSettings) => {
    const next: PortfolioConfig = {
      ...config,
      pdf_profiles: {
        ...(config.pdf_profiles ?? {}),
        [purpose]: { ...(config.pdf_profiles?.[purpose] ?? {}), [format]: settings },
      },
    }
    setConfig(next)
    setSaveBusy(true)
    const result = await savePortfolioConfig(next, { ifMatch: portfolioEtag })
    setSaveBusy(false)
    if ('ok' in result) {
      setPortfolioEtag(result.etag)
      setStorageStale(false)
      alert(t('portfolio_config_saved'))
    } else if (result.error === PORTFOLIO_SAVE_ERR.ETAG_MISMATCH) {
      await handlePortfolioEtagConflict()
    } else if (result.error === PORTFOLIO_SAVE_ERR.OBJECT_EXISTS) {
      alert(t('portfolio_save_object_exists'))
    } else {
      alert(`${t('error_prefix')} ${result.error}`)
    }
  }, [config, portfolioEtag, t, handlePortfolioEtagConflict])

  // ── Theme assignment ──────────────────────────────────────────────────────

  const handleTransfer = useCallback((value: string) => {
    if (!activeSlot) return
    const { page, index, modeIdx } = activeSlot
    const next = { ...config }
    if (page === 'sections') {
      const prev = next.sections[index]
      const canonical = canonicalCollectionTheme(
        { theme: value, title_fr: prev.title_fr, title_en: prev.title_en }, themes,
      ) ?? value
      next.sections[index] = {
        ...prev, theme: canonical,
        ...(normalizeTheme(prev.theme) !== normalizeTheme(canonical) ? { manual_work_order: [] } : {}),
      }
    } else {
      const m = modeIdx ?? activeMode
      const modes = next.works_modes.slice()
      const cols = modes[m].collections.slice()
      const prev = cols[index]
      const canonical = canonicalCollectionTheme(
        { theme: value, title_fr: prev.title_fr, title_en: prev.title_en }, themes,
      ) ?? value
      cols[index] = {
        ...prev, theme: canonical,
        ...(normalizeTheme(prev.theme) !== normalizeTheme(canonical) ? { manual_work_order: [] } : {}),
      }
      modes[m] = { ...modes[m], collections: cols }
      next.works_modes = modes
    }
    setConfig(next)
    setActiveSlot(null)
  }, [activeSlot, activeMode, config, themes])

  // ── Visibility helpers ────────────────────────────────────────────────────

  const handleMakePublic = useCallback(async (oeuvreId: number) => {
    const res = await setWorkPublic(oeuvreId)
    if ('error' in res) { alert(`${t('error_prefix')} ${res.error}`); return }
    router.refresh()
  }, [t, router])

  // ── Theme derived data ────────────────────────────────────────────────────

  const themeNames = useMemo(
    () => themes.map(th => th.name).sort((a, b) => a.localeCompare(b, 'fr')),
    [themes],
  )

  const themeNameStats = useMemo(() => {
    const map: Record<string, { total: number; pub: number }> = {}
    for (const th of themes) {
      const s = themePublicStats[th.id]
      if (s) map[th.name] = s
    }
    return map
  }, [themes, themePublicStats])

  const oeuvreThemeLite = useMemo(() => {
    const m = new Map<number, ThemeWork>()
    for (const o of oeuvres) {
      m.set(o.OeuvreID, {
        OeuvreID: o.OeuvreID,
        txtImageNameLink: o.txtImageNameLink ?? null,
        isPublic: !!o.is_public,
      })
    }
    return m
  }, [oeuvres])

  const privateWorksForThemeLabel = useCallback(
    (label: string | null | undefined): ThemeWork[] | undefined => {
      const ws = themeWorksForCollectionLabel(label, themes, themePrivateWorks, oeuvreThemeLite)
      return ws.length > 0 ? ws : undefined
    },
    [themes, themePrivateWorks, oeuvreThemeLite],
  )

  const workById = useMemo(() => new Map(oeuvres.map(o => [o.OeuvreID, o])), [oeuvres])

  const worksForCollectionItem = useCallback((item: CollectionItem): PdfWorkCandidate[] => {
    const manualIds = Array.isArray(item.manual_work_order)
      ? item.manual_work_order.map(Number).filter(Number.isFinite)
      : []
    const visible = item.theme
      ? themeWorksForCollectionLabel(item.theme, themes, themePrivateWorks, oeuvreThemeLite).filter(w => w.isPublic)
      : []
    const seen = new Set<number>()
    const orderedIds: number[] = []
    const themeWorkIds = new Set(visible.map(w => w.OeuvreID))
    for (const id of manualIds) {
      if (!themeWorkIds.has(id)) continue
      const work = workById.get(id)
      if (work?.txtImageNameLink && work.is_public && !seen.has(id)) {
        seen.add(id); orderedIds.push(id)
      }
    }
    for (const w of visible) {
      if (!seen.has(w.OeuvreID)) { seen.add(w.OeuvreID); orderedIds.push(w.OeuvreID) }
    }
    return orderedIds.flatMap(id => {
      const work = workById.get(id)
      if (!work?.txtImageNameLink) return []
      return [{ OeuvreID: work.OeuvreID, Titre: work.Titre, Annee: work.Année,
                Hauteur: work.Hauteur, Largeur: work.Largeur, txtImageNameLink: work.txtImageNameLink }]
    })
  }, [themes, themePrivateWorks, oeuvreThemeLite, workById])

  // ── Works-mode helpers ────────────────────────────────────────────────────

  const updateMode = useCallback((i: number, patch: Partial<WorksMode>) => {
    setConfig(prev => {
      const modes = prev.works_modes.slice()
      modes[i] = { ...modes[i], ...patch }
      return { ...prev, works_modes: modes }
    })
  }, [])

  const addMode = useCallback(() => {
    setConfig(prev => {
      const newMode: WorksMode = {
        id: Math.random().toString(36).slice(2),
        label_fr: `Mode ${prev.works_modes.length + 1}`,
        label_en: `Mode ${prev.works_modes.length + 1}`,
        is_active: true,
        sort_order: prev.works_modes.length,
        layout: 'carousel',
        collections: [],
        outro_fr: '', outro_en: '',
        bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
        bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
        light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
        light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
        light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
        light_circadian: false,
        cast_shadow_enabled: true,
        cast_shadow_distance_px: WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
        cast_shadow_blur_px: WORKS_CAST_SHADOW_BLUR_DEFAULT,
        mobile_fallback: 'auto' as const,
      }
      setActiveMode(prev.works_modes.length)
      return { ...prev, works_modes: [...prev.works_modes, newMode] }
    })
  }, [])

  const deleteMode = useCallback((i: number) => {
    setConfig(prev => {
      if (prev.works_modes.length <= 1) { alert(t('portfolio_one_mode_required')); return prev }
      const label = lang === 'en'
        ? prev.works_modes[i].label_en || prev.works_modes[i].label_fr
        : prev.works_modes[i].label_fr || prev.works_modes[i].label_en
      if (!confirm(t('portfolio_confirm_delete_mode_fmt').replace(/\{label\}/g, label))) return prev
      const modes = prev.works_modes.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sort_order: idx }))
      setActiveMode(am => Math.max(0, Math.min(am, modes.length - 1)))
      return { ...prev, works_modes: modes }
    })
  }, [t, lang])

  const moveMode = useCallback((from: number, to: number) => {
    setConfig(prev => {
      if (to < 0 || to >= prev.works_modes.length) return prev
      const modes = reorder(prev.works_modes, from, to).map((m, i) => ({ ...m, sort_order: i }))
      setActiveMode(am => {
        if (am === from) return to
        if (from < am && to >= am) return am - 1
        if (from > am && to <= am) return am + 1
        return am
      })
      return { ...prev, works_modes: modes }
    })
  }, [])

  const addModeCollection = useCallback((m: number) => {
    setConfig(prev => {
      const modes = prev.works_modes.slice()
      const newItem: CollectionItem = {
        id: Math.random().toString(36).slice(2),
        title_fr: '', title_en: '',
        intro_fr: '', intro_en: '',
        description_fr: '', description_en: '',
        theme: null,
        sort_order: modes[m].collections.length,
        is_active: true,
      }
      modes[m] = { ...modes[m], collections: [...modes[m].collections, newItem] }
      return { ...prev, works_modes: modes }
    })
  }, [])

  const moveModeCollection = useCallback((m: number, from: number, to: number) => {
    setConfig(prev => {
      const list = prev.works_modes[m].collections
      if (to < 0 || to >= list.length) return prev
      const cols = reorder(list, from, to).map((c, i) => ({ ...c, sort_order: i }))
      const modes = prev.works_modes.slice()
      modes[m] = { ...modes[m], collections: cols }
      return { ...prev, works_modes: modes }
    })
  }, [])

  const updateModeCollection = useCallback((m: number, i: number, patch: Partial<CollectionItem>) => {
    setConfig(prev => {
      const modes = prev.works_modes.slice()
      const cols = modes[m].collections.slice()
      cols[i] = { ...cols[i], ...patch }
      modes[m] = { ...modes[m], collections: cols }
      return { ...prev, works_modes: modes }
    })
  }, [])

  const deleteModeCollection = useCallback((m: number, id: string) => {
    setConfig(prev => {
      const modes = prev.works_modes.slice()
      modes[m] = { ...modes[m], collections: modes[m].collections.filter(c => c.id !== id) }
      return { ...prev, works_modes: modes }
    })
  }, [])

  // ── Portfolio-section helpers ─────────────────────────────────────────────

  const addItem = useCallback((target: 'sections' | 'works_collections') => {
    setConfig(prev => {
      const newItem: CollectionItem = {
        id: Math.random().toString(36).slice(2),
        title_fr: '', title_en: '',
        intro_fr: '', intro_en: '',
        description_fr: '', description_en: '',
        theme: null,
        sort_order: prev[target].length,
        is_active: true,
      }
      return { ...prev, [target]: [...prev[target], newItem] }
    })
  }, [])

  const moveCollection = useCallback((target: 'sections' | 'works_collections', from: number, to: number) => {
    setConfig(prev => {
      const list = prev[target]
      if (to < 0 || to >= list.length) return prev
      const next = reorder(list, from, to).map((c, i) => ({ ...c, sort_order: i }))
      return { ...prev, [target]: next }
    })
  }, [])

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    config, setConfig,
    loading,
    activeMode, setActiveMode,
    activeSlot, setActiveSlot,
    saveBusy,
    pdfOpen, setPdfOpen,
    isDirty,
    savedAt,
    storageStale,
    themeNames,
    themeNameStats,
    privateWorksForThemeLabel,
    worksForCollectionItem,
    handleSave,
    savePdfProfile,
    handleTransfer,
    handleMakePublic,
    loadData,
    updateMode, addMode, deleteMode, moveMode,
    addModeCollection, moveModeCollection, updateModeCollection, deleteModeCollection,
    addItem, moveCollection,
  }
}
