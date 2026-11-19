import { defineMessages } from '../message-core'

/** Catalogue → Thèmes: copy a theme into a working group and back (Pem 2026-11-19: themes = creation, groups = business). */
export const themeGroupCopyMessages = defineMessages({
  themes_copy_to_group: { fr: 'Copier en groupe', en: 'Copy as a group' },
  themes_copy_to_theme: { fr: 'Copier en thème', en: 'Copy as a theme' },
  themes_copy_to_group_exists_fmt: {
    fr: 'Un groupe « {name} » existe déjà. Y ajouter les œuvres du thème « {source} » qui n’y sont pas encore ?',
    en: 'A group « {name} » already exists. Add the works of theme « {source} » that are not in it yet?',
  },
  themes_copy_to_theme_exists_fmt: {
    fr: 'Un thème « {name} » existe déjà. Y ajouter les œuvres du groupe « {source} » qui n’y sont pas encore ?',
    en: 'A theme « {name} » already exists. Add the works of group « {source} » that are not in it yet?',
  },
  themes_copy_done_fmt: {
    fr: '« {name} » : {added} œuvre(s) ajoutée(s), {already} déjà présente(s)',
    en: '« {name} »: {added} work(s) added, {already} already there',
  },
  themes_copy_cancelled: { fr: 'Rien n’a été copié.', en: 'Nothing was copied.' },
})
