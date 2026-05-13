export type CoaVerifyOutcome =
  | { ok: false; reason: 'invalid_id' | 'not_found' | 'tampered' | 'config' }
  | {
      ok: true
      certId: string
      oeuvreId: number
      titre: string
      anneeDisplay: string
      issuedAt: string
    }
