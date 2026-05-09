### Résumé du contenu du fichier `gemini.md` :

* **Identité du Projet** : Stack Next.js 15, Supabase (ID `mcrzsxrcoexnlwmaunte`) et Cloudflare R2 pour le stockage.
* **Règles de Conduite de l'IA** :
* **Prudence absolue** : Pas de modification sans validation explicite ("GO/EXECUTE").
* **Simplicité (KISS)** : Code minimal, pas d'abstractions inutiles.
* **Chirurgie du code** : Ne modifier que le strict nécessaire sans toucher au style ou au code adjacent.


* **Spécifications Techniques** :
* Gestion du stockage via R2 (Public/Privé).
* Schéma de base de données strict (colonnes canoniques vs colonnes dépréciées).
* Automatisation via triggers (synchronisation `is_public` et images de couverture).


* **Inventaire DB** : Liste exhaustive des tables actives (36 tables) et de leurs rôles respectifs.

Ce document servira de "mémoire contextuelle" pour garantir que chaque session de développement respecte scrupuleusement l'architecture et les conventions de votre base de données d'art.