import { defineMessages } from '../message-core'

export const worldMapUiMessages = defineMessages({
  map_view_label: {
    fr: 'Vue',
    en: 'View',
  },
  map_mode_contacts_fmt: {
    fr: 'Contacts ({count} adresses)',
    en: 'Contacts ({count} addresses)',
  },
  map_mode_creation_fmt: {
    fr: 'Création ({count})',
    en: 'Making ({count})',
  },
  map_creation_hint: {
    fr: 'Où les œuvres ont été faites · plein = lieu précis (Historique de création) · anneau = atelier de la période · pointillé = lieu suggéré par une séance (GPS)',
    en: 'Where the works were made · solid = own place (making history) · ring = the period’s studio · dotted = place suggested by a session (GPS)',
  },
  map_creation_summary_fmt: {
    fr: '{placed} situées · {precise} lieu précis · {byPeriod} par période · {none} sans lieu',
    en: '{placed} placed · {precise} own place · {byPeriod} by period · {none} no place',
  },
  map_creation_pin_sub_fmt: {
    fr: '{precise} lieu précis · {byPeriod} par période',
    en: '{precise} own place · {byPeriod} by period',
  },
  map_creation_works_fmt: {
    fr: '{count} œuvres',
    en: '{count} works',
  },
  map_creation_period_label: {
    fr: 'Période',
    en: 'Period',
  },
  map_creation_all_periods: {
    fr: 'Toutes',
    en: 'All',
  },
  map_creation_gps_fmt: {
    fr: 'Séance du {day} · lieu suggéré : {place}',
    en: 'Session {day} · suggested place: {place}',
  },
  map_creation_gps_none_fmt: {
    fr: 'Séance du {day} · aucun lieu connu à moins de 2 km',
    en: 'Session {day} · no known place within 2 km',
  },
  map_creation_see_in_time: {
    fr: 'Voir dans le temps',
    en: 'See in time',
  },
  map_creation_span_fmt: {
    fr: 'Faites entre {from} et {to}',
    en: 'Made between {from} and {to}',
  },
  map_creation_loading: {
    fr: 'Chargement des lieux de création…',
    en: 'Loading where works were made…',
  },
  map_creation_error: {
    fr: 'Lieux de création indisponibles',
    en: 'Places of making unavailable',
  },
  map_mode_works_fmt: {
    fr: 'Œuvres ({count})',
    en: 'Works ({count})',
  },
  map_works_marker_hint: {
    fr: 'Marqueur · clic dr. → fiche · Ctrl+clic dr. → 2e œuvre si plusieurs au point',
    en: 'Marker · right-click → record · Ctrl+right-click → 2nd work when stacked',
  },
  map_geocoding_fmt: {
    fr: 'Géocodage… {count} point',
    en: 'Geocoding… {count} point',
  },
  map_geocoding_plural_fmt: {
    fr: 'Géocodage… {count} points',
    en: 'Geocoding… {count} points',
  },
  map_refresh: {
    fr: '↺ Rafraîchir',
    en: '↺ Refresh',
  },
  map_clear_filters: {
    fr: '✕ Filtres',
    en: '✕ Filters',
  },
  map_country_label: {
    fr: 'Pays',
    en: 'Country',
  },
  map_all_countries: {
    fr: 'Tous pays',
    en: 'All countries',
  },
  map_roles_label: {
    fr: 'Rôles',
    en: 'Roles',
  },
  map_show_on_map: {
    fr: 'Afficher sur la carte',
    en: 'Show on map',
  },
  map_hide_from_map: {
    fr: 'Masquer',
    en: 'Hide',
  },
  map_no_role: {
    fr: 'Sans rôle',
    en: 'No role',
  },
  map_status_label: {
    fr: 'Statut',
    en: 'Status',
  },
  map_no_status: {
    fr: 'Sans statut',
    en: 'No status',
  },
  map_theme_label: {
    fr: 'Thème',
    en: 'Theme',
  },
  map_no_theme: {
    fr: 'Sans thème',
    en: 'No theme',
  },
  map_technique_label: {
    fr: 'Technique',
    en: 'Technique',
  },
  map_no_technique: {
    fr: 'Sans technique',
    en: 'No technique',
  },
  map_chips_all: {
    fr: 'Tous',
    en: 'All',
  },
  map_chips_none: {
    fr: 'Aucun',
    en: 'None',
  },
  map_chip_hint: {
    fr: 'Clic : masquer / afficher · Alt-clic ou appui long : seulement celui-ci',
    en: 'Click: hide / show · Alt-click or long-press: only this one',
  },
})
