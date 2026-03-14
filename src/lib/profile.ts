export interface UserProfile {
  province: string
  immigrationStatus:
    | 'citizen'
    | 'permanent_resident'
    | 'work_permit'
    | 'student_visa'
    | 'refugee'
    | 'asylum_seeker'
    | 'undocumented'
    | 'unknown'
  residencyStartDate: string
  ageBand: '0-17' | '18-25' | '26-35' | '36-45' | '46-55' | '56-64' | '65+'
  employmentStatus:
    | 'student'
    | 'employed'
    | 'self_employed'
    | 'unemployed'
    | 'retiree'
  hasEmployerBenefits: 'yes' | 'no' | 'unknown'
  dependants: { spouse: boolean; children: number }
  incomeBand: 'low' | 'medium' | 'high' | 'prefer_not_to_say'
  specialCategory:
    | 'refugee'
    | 'temp_foreign_worker'
    | 'intl_student'
    | 'asylum_seeker'
    | null
}

export const EMPTY_PROFILE: UserProfile = {
  province: 'unknown',
  immigrationStatus: 'unknown',
  residencyStartDate: 'unknown',
  ageBand: '18-25',
  employmentStatus: 'unemployed',
  hasEmployerBenefits: 'unknown',
  dependants: { spouse: false, children: 0 },
  incomeBand: 'prefer_not_to_say',
  specialCategory: null,
}
