import { defineMessages } from '../message-core'

export const analyticsUiMessages = defineMessages({
  analytics_net_page_views: {
    fr: 'Pages vues (net)',
    en: 'Page views (net)',
  },
  analytics_net_visitors: {
    fr: 'Visiteurs net',
    en: 'Net visitors',
  },
  analytics_net_visitors_hint: {
    fr: 'Hors sessions Atelier et ids exclus (ANALYTICS_EXCLUDE_VISITOR_IDS). Les vues localhost/dev ne sont pas enregistrées.',
    en: 'Excludes Atelier team sessions and excluded browser ids (ANALYTICS_EXCLUDE_VISITOR_IDS). Localhost/dev views are not recorded.',
  },
  analytics_trend_views_per_day: {
    fr: 'Tendance net (vues / jour)',
    en: 'Net trend (views / day)',
  },
  analytics_top_pages: {
    fr: 'Top pages (net)',
    en: 'Top pages (net)',
  },
  analytics_top_countries: {
    fr: 'Pays (net)',
    en: 'Countries (net)',
  },
  analytics_top_sources: {
    fr: 'Sources (net)',
    en: 'Sources (net)',
  },
  analytics_data_footnote: {
    fr: 'page_view · agrégats net uniquement · id visiteur = localStorage (site public) · UTC',
    en: 'page_view · net aggregates only · visitor id = public-site localStorage · UTC',
  },
  analytics_sparkline_point_title_fmt: {
    fr: '{date} · {views} vues net',
    en: '{date} · {views} net views',
  },
})
