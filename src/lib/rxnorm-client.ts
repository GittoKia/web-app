import 'server-only'

/**
 * RxNorm + OpenFDA API client for medication lookup.
 * Both are completely free, no API keys required.
 *
 * RxNorm: https://rxnav.nlm.nih.gov/REST
 * OpenFDA: https://api.fda.gov/drug/
 */

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST'
const OPENFDA_BASE = 'https://api.fda.gov/drug'

export type RxNormDrug = {
  rxcui: string
  name: string
  synonym?: string
  tty?: string // term type
}

export type DrugInteraction = {
  description: string
  severity?: string
  source?: string
  interactingDrug: string
}

export type OpenFdaDrugLabel = {
  brand_name?: string[]
  generic_name?: string[]
  purpose?: string[]
  warnings?: string[]
  dosage_and_administration?: string[]
  indications_and_usage?: string[]
  active_ingredient?: string[]
}

/**
 * Search for a drug by name using RxNorm approximate match.
 */
export async function searchDrug(name: string): Promise<RxNormDrug[]> {
  const url = `${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=5`

  const response = await fetch(url, {
    next: { revalidate: 86400 },
  })

  if (!response.ok) {
    return []
  }

  const data = (await response.json()) as {
    approximateGroup?: {
      candidate?: Array<{ rxcui: string; name: string; score: string }>
    }
  }

  const candidates = data.approximateGroup?.candidate ?? []

  return candidates.map((c) => ({
    rxcui: c.rxcui,
    name: c.name,
  }))
}

/**
 * Get drug properties by RxCUI.
 */
export async function getDrugProperties(rxcui: string) {
  const url = `${RXNORM_BASE}/rxcui/${rxcui}/allProperties.json?prop=names`

  const response = await fetch(url, {
    next: { revalidate: 86400 },
  })

  if (!response.ok) return null

  const data = (await response.json()) as {
    propConceptGroup?: {
      propConcept?: Array<{ propName: string; propValue: string }>
    }
  }

  return data.propConceptGroup?.propConcept ?? []
}

/**
 * Get drug interactions for a given RxCUI.
 */
export async function getDrugInteractions(rxcui: string): Promise<DrugInteraction[]> {
  const url = `${RXNORM_BASE}/interaction/interaction.json?rxcui=${rxcui}`

  const response = await fetch(url, {
    next: { revalidate: 86400 },
  })

  if (!response.ok) return []

  const data = (await response.json()) as {
    interactionTypeGroup?: Array<{
      interactionType?: Array<{
        interactionPair?: Array<{
          description: string
          severity?: string
          interactionConcept?: Array<{
            minConceptItem?: { name: string; rxcui: string }
            sourceConceptItem?: { name: string }
          }>
        }>
      }>
    }>
  }

  const interactions: DrugInteraction[] = []

  for (const group of data.interactionTypeGroup ?? []) {
    for (const type of group.interactionType ?? []) {
      for (const pair of type.interactionPair ?? []) {
        const interactingDrug =
          pair.interactionConcept?.[1]?.minConceptItem?.name ??
          pair.interactionConcept?.[0]?.sourceConceptItem?.name ??
          'Unknown'

        interactions.push({
          description: pair.description,
          severity: pair.severity,
          interactingDrug,
        })
      }
    }
  }

  return interactions
}

/**
 * Search OpenFDA for drug label information (brand names, warnings, usage).
 */
export async function searchDrugLabel(drugName: string): Promise<OpenFdaDrugLabel | null> {
  const url = `${OPENFDA_BASE}/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"+openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`

  const response = await fetch(url, {
    next: { revalidate: 86400 },
  })

  if (!response.ok) return null

  const data = (await response.json()) as {
    results?: Array<{
      openfda?: {
        brand_name?: string[]
        generic_name?: string[]
      }
      purpose?: string[]
      warnings?: string[]
      dosage_and_administration?: string[]
      indications_and_usage?: string[]
      active_ingredient?: string[]
    }>
  }

  const result = data.results?.[0]
  if (!result) return null

  return {
    brand_name: result.openfda?.brand_name,
    generic_name: result.openfda?.generic_name,
    purpose: result.purpose,
    warnings: result.warnings?.map((w) => w.slice(0, 500)),
    dosage_and_administration: result.dosage_and_administration?.map((d) => d.slice(0, 500)),
    indications_and_usage: result.indications_and_usage?.map((u) => u.slice(0, 500)),
    active_ingredient: result.active_ingredient,
  }
}

/**
 * Aggregate drug info from both RxNorm and OpenFDA for a given drug name.
 */
export async function lookupDrug(name: string) {
  const [rxResults, fdaLabel] = await Promise.all([
    searchDrug(name),
    searchDrugLabel(name),
  ])

  const topMatch = rxResults[0] ?? null
  let interactions: DrugInteraction[] = []

  if (topMatch) {
    interactions = await getDrugInteractions(topMatch.rxcui)
  }

  return {
    query: name,
    rxcui: topMatch?.rxcui ?? null,
    normalizedName: topMatch?.name ?? fdaLabel?.generic_name?.[0] ?? name,
    brandNames: fdaLabel?.brand_name ?? [],
    genericNames: fdaLabel?.generic_name ?? [],
    purpose: fdaLabel?.indications_and_usage?.[0] ?? fdaLabel?.purpose?.[0] ?? null,
    warnings: fdaLabel?.warnings ?? [],
    interactions: interactions.slice(0, 5),
  }
}

export type DrugLookupResult = {
  query: string
  rxcui: string | null
  normalizedName: string
  brandNames: string[]
  genericNames: string[]
  purpose: string | null
  warnings: string[]
  interactions: DrugInteraction[]
}
