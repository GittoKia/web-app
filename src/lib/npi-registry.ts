import 'server-only'

/**
 * NPI Registry API client.
 * Completely free, no API key required.
 * Docs: https://npiregistry.cms.hhs.gov/api-page
 */

const NPI_BASE_URL = 'https://npiregistry.cms.hhs.gov/api'

export type NpiResult = {
  number: number
  basic: {
    first_name?: string
    last_name?: string
    organization_name?: string
    credential?: string
    sole_proprietor?: string
    gender?: string
    enumeration_date?: string
    last_updated?: string
  }
  taxonomies: Array<{
    code: string
    taxonomy_group?: string
    desc: string
    state?: string
    license?: string
    primary: boolean
  }>
  addresses: Array<{
    address_purpose: string
    address_1: string
    address_2?: string
    city: string
    state: string
    postal_code: string
    telephone_number?: string
    fax_number?: string
  }>
}

export type NpiSearchResponse = {
  result_count: number
  results: NpiResult[]
}

export type NpiSearchParams = {
  firstName?: string
  lastName?: string
  organizationName?: string
  city?: string
  state?: string
  postalCode?: string
  taxonomyDescription?: string
  limit?: number
}

export async function searchProviders(params: NpiSearchParams): Promise<NpiSearchResponse> {
  const url = new URL(NPI_BASE_URL)
  url.searchParams.set('version', '2.1')
  url.searchParams.set('limit', String(params.limit ?? 10))

  if (params.firstName) url.searchParams.set('first_name', params.firstName)
  if (params.lastName) url.searchParams.set('last_name', params.lastName)
  if (params.organizationName) url.searchParams.set('organization_name', params.organizationName)
  if (params.city) url.searchParams.set('city', params.city)
  if (params.state) url.searchParams.set('state', params.state)
  if (params.postalCode) url.searchParams.set('postal_code', params.postalCode)
  if (params.taxonomyDescription) url.searchParams.set('taxonomy_description', params.taxonomyDescription)

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86400 }, // Cache for 24 hours
  })

  if (!response.ok) {
    throw new Error(`NPI Registry error ${response.status}`)
  }

  return response.json() as Promise<NpiSearchResponse>
}

/**
 * Normalize an NPI result for display and LLM context.
 */
export function normalizeProvider(result: NpiResult) {
  const isOrg = !!result.basic.organization_name
  const practiceAddress = result.addresses?.find((a) => a.address_purpose === 'LOCATION') ?? result.addresses?.[0]
  const primaryTaxonomy = result.taxonomies?.find((t) => t.primary) ?? result.taxonomies?.[0]

  return {
    npi: result.number,
    name: isOrg
      ? result.basic.organization_name!
      : [result.basic.first_name, result.basic.last_name].filter(Boolean).join(' '),
    credential: result.basic.credential ?? null,
    specialty: primaryTaxonomy?.desc ?? null,
    address: practiceAddress
      ? {
          street: [practiceAddress.address_1, practiceAddress.address_2].filter(Boolean).join(', '),
          city: practiceAddress.city,
          state: practiceAddress.state,
          zip: practiceAddress.postal_code?.slice(0, 5),
          phone: practiceAddress.telephone_number ?? null,
        }
      : null,
    isOrganization: isOrg,
  }
}

export type NormalizedProvider = ReturnType<typeof normalizeProvider>
