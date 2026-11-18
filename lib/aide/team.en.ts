import type { AideChapter } from './types'

/** Team guide — English. Same chapters, same order as `team.fr.ts`. */
export const TEAM_EN: AideChapter[] = [
  {
    id: 'scope',
    title: 'The project and its scope',
    verified: '2026-11-18',
    md: `
## What the app is for

PEM Studio is the working tool of Pem's atelier. It keeps a trace of the work in all its forms: the paintings, the writings, anything to do with his wondering at the world. The aim: to pass it on, to create links between things, and to give the work its value.

> "I hope somebody, now or in the future, will be able to extract from my painting some joy, emotion, mystery: anything that creates true value to other humans." Pem

## The four aims, in order

1. **Trace**: nothing gets lost. Capture is quick, on the phone, in the field.
2. **Links and mapping**: search, suggestions, the journal linked to the works, the Constellation, the map.
3. **Transmission**: the public site, portfolios, diffusion; and an archive that stays readable without the app.
4. **Value**: what the work gives to others. Provenance, condition reports and certificates support it.

When you are unsure what to record or what to ask for, these aims decide, in this order.

## What the app covers

- **The catalogue**: every work, its photos, dimensions, condition, history, who owns it, who holds it and where it is.
- **Production**: works under way, up to the catalogue.
- **The field**: the day (Today), the journal, voice notes, photographed work sessions.
- **Ideas**: projects and concepts.
- **Commercial**: orders (sale, gift, loan, deposit), shipments, contacts, income and expenses, the Vault (documents).
- **Public**: the www.thepemworkshop.com site, PDF portfolios, visitor statistics.

The commercial tools stay simple: they only grow when a real case needs it.

## Who uses it

- Pem (admin) and the atelier team, each with their own account. There is no public sign-up: the atelier creates the accounts.
- **The phone is for the field**: capture, fix, move things along. **The computer is for the deeper work**: the catalogue, tables, commercial.
- A team member sees almost everything. Some changes to an existing work wait for an admin's approval, and a few screens are for admins only.

## What the app does not do

- It does not edit photos. Catalogue photos are prepared in Lightroom, then sent to the app through the phone's Share menu.
- There is no public sign-up and no visitor account: the team signs in with accounts the atelier creates.
`,
  },
  {
    id: 'start',
    title: 'Getting started',
    verified: '2026-11-18',
    md: `
## Signing in

1. Open www.thepemworkshop.com/login.
2. Enter your email and password, or use the Google button.
3. Lost password: "Forgot password?" on the same page sends you a link by email.

To change your password or sign out: at the bottom of the ☰ menu on the phone, in the header on the computer.

## Installing the app on the phone

- **iPhone**: open the site in Safari, tap Share, then "Add to Home Screen".
- **Android**: open the site in Chrome, ⋮ menu, then "Install app" or "Add to Home screen".

The icon opens **Today** directly. Once installed, the app also shows in the phone's Share menu: that is how photos exported from Lightroom come in.

## On the phone: Today

Today is the home screen: the day. It shows what was done, the works of the day, writings and notes, and "See again".

- ‹ › moves to the day before or after.
- 📅 opens the list of days (the Journal).
- The bottom bar captures in one tap: **Write** · **Voice** · **Work** · **Photo · doc**.

## On the phone: the ☰ menu

☰ opens the menu over the page, on every screen.

- **At the top, search**: type #1234 or part of a title, and the work's card opens.
- **The tiles**, with their counts: Today, Works, Production, Ideas, Orders, Logistics, Events, Journal. Admins also see the Feed.
- **"Everything else"** (folded): all the other screens.
- **"Actions"** (folded): Sale, Contact (business card), Document, Issue, Pipeline, Triage.
- **At the bottom**: your account, the language (FR / EN), sign out.

On the other screens, the "Today" chip at the top right takes you back to the day.

## On the computer: the sidebar

Screens are sorted into groups:

- **Kaizen**: Operations & Strategy, and this Help.
- **Catalogue**: Inventory, Reports, Themes / Groups, Constellation, Timeline, Slideshows.
- **Field**: Production, Journal.
- **Studio**: Overview, Pipeline, Exhibitions, Ideas, Supplies.
- **Business**: Orders, Contacts, Map, Logistics, Income & Expenses, Vault.
- **Public**: Public site, Portfolio, Analytics.

Everywhere:

- **⌘K** (Mac) or **Ctrl+K** (PC) opens search: a work, a screen, an action.
- Clicking a work opens its card at the side.
- The **FR / EN** buttons in the header change the language.

## This guide

- Each chapter carries the date it was checked in the app. If the screen no longer matches the guide, the screen is right: report it in Kaizen → Operations & Strategy (+ New entry).
- What changed since: Kaizen → Operations & Strategy → **What's new**.
- The guide follows the app's language.
`,
  },
]
