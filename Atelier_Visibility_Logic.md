# Atelier Data & Visibility Logic Map

This diagram maps exactly how your database fields control the visibility of artworks across the different front-end modules, and the specific "if this, then that" logic required to unlock images for the public.

```mermaid
flowchart TD
    %% Styling
    classDef form fill:#2a2825,stroke:#b0aca6,stroke-width:1px,color:#dedad4
    classDef db fill:#3a3834,stroke:#c8c4be,stroke-width:2px,color:#fff,font-weight:bold
    classDef logic fill:#1f1e1c,stroke:#8a8680,stroke-width:1px,color:#b0aca6,stroke-dasharray: 5 5
    classDef public fill:#1a362f,stroke:#2d5c50,stroke-width:2px,color:#fff
    classDef private fill:#361a1a,stroke:#5c2d2d,stroke-width:2px,color:#fff
    classDef condition fill:#3b3628,stroke:#b8a265,stroke-width:2px,color:#fff,shape:rhombus

    %% Inputs
    Input(["Artist Input (WorkForm.tsx)"]) --> DB[(Supabase 'Oeuvres' Table)]
    class Input form
    class DB db

    %% Database Core Fields
    subgraph DB_Fields [Core Database Fields]
        direction TB
        img[txtImageNameLink\nHas Image?]
        pub[is_public\nMaster Public Switch]
        stat[statusId\nInventory Status]
        exp[Exposable\nExhibition Ready?]
    end
    DB --- DB_Fields
    class DB_Fields db

    %% Logic Gates
    subgraph Gate_Images [Image Validation]
        direction TB
        checkImg{"Does Image\nExist?"}
    end
    img --> checkImg
    class checkImg condition

    subgraph Gate_Public [Public Visibility Validation]
        direction TB
        checkPub{"is_public\n== TRUE?"}
    end
    pub --> checkPub
    class checkPub condition

    %% Front-End Targets
    HUB["Atelier Hub / Inventory\n(Internal)"]
    WORKS["/works\n(Public Website)"]
    PORTFOLIO["/portfolio\n(Public Presentation)"]

    class HUB private
    class WORKS public
    class PORTFOLIO public

    %% Flow: Hub
    stat -->|Determines category\n(WIP, Sold, Studio)| HUB
    checkImg -->|If False: Shows Placeholder\nIf True: Shows Thumbnail| HUB

    %% Flow: Works & Portfolio
    checkPub -->|FALSE| Hide[Hidden from Public Sites]
    checkPub -->|TRUE| checkImg2{"Does Image\nExist?"}
    class checkImg2 condition

    checkImg2 -->|FALSE| Hide
    class Hide private

    checkImg2 -->|TRUE| ThemeMatch{"Theme / Config\nMatch?"}
    class ThemeMatch condition

    ThemeMatch -->|Fuzzy Match against\nportfolio_sections.json| PORTFOLIO
    ThemeMatch -->|Fuzzy Match against\nlocal collections| WORKS

    %% Edge Cases
    exp -.->|Used by Exhibition Module\nto filter available works| HUB
```

### Logic Rules Explained: "If This, Then That"

#### 1. The Hub & Internal Inventory
*   **IF** an artwork exists in the database, **THEN** it is always visible in the Hub.
*   **IF** `txtImageNameLink` is null, **THEN** it displays a blank white placeholder.
*   **IF** `statusId` is changed, **THEN** the artwork physically moves between columns (e.g., WIP → Available).

#### 2. The Public Master Switch (`is_public`)
*   **IF** `is_public` is **FALSE**, **THEN** the artwork is entirely invisible to the outside world. It will not load on `/works` and it will not load on `/portfolio`.
*   *Note: This overrides inventory status. An artwork can be "Sold" (statusId) but still visible on the portfolio if `is_public` is true.*

#### 3. The Image Prerequisite
*   **IF** `is_public` is **TRUE** but `txtImageNameLink` is **NULL**, **THEN** the artwork is hidden from the public sites. 
*   *Why? Because rendering an empty white box on a public presentation portfolio looks like a broken website. It requires an image to render.*

#### 4. The Theme Match Bridge (Fuzzy Match)
*   **IF** `is_public` is TRUE and an image exists, **THEN** the system checks its assigned themes.
*   **IF** the artwork's theme contains a word that matches the collection configuration (e.g., database says "Púrinos [San Titre]", config says "Pürinos"), **THEN** the artwork "unlocks" and is successfully pushed into the dynamic slider on `/portfolio` and the list on `/works`.

#### 5. Exposable (Exhibition Ready)
*   *Currently isolated from the public website.*
*   **IF** `Exposable` is TRUE, **THEN** it marks the artwork as physically ready to leave the studio for an exhibition (framed, varnished, etc.). It helps you filter lists when planning a show in the Exhibitions module, but it does **not** stop a piece from being shown on your digital portfolio.
