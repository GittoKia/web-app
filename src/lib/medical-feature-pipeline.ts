import 'server-only'

import { z } from 'zod'
import { generateStructuredObject } from '@/lib/llm-client'

const extractionModelName = process.env.MEDICAL_EXTRACTION_MODEL ?? process.env.LLM_MODEL ?? 'openai/gpt-oss-120b'

const uploadedDocumentSchema = z.object({
  id: z.string().optional(),
  fileName: z.string().optional(),
  documentType: z.enum([
    'physician_note',
    'lab_report',
    'prescription',
    'discharge_summary',
    'imaging_report',
    'other',
  ]),
  text: z.string().min(1),
})

export const medicalFeaturePipelineInputSchema = z.object({
  patientDemographics: z.object({
    name: z.string().min(1),
    age: z.number().int().min(0).max(120),
    nationality: z.string().min(1),
  }),
  patientMedicalHistory: z.string().default(''),
  uploadedMedicalDocuments: z.array(uploadedDocumentSchema).default([]),
})

const extractedItemSchema = z.object({
  rawText: z.string(),
  normalizedName: z.string(),
  status: z.enum(['active', 'historical', 'resolved', 'suspected', 'unknown']),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence: z.string(),
  sourceIds: z.array(z.string()).default([]),
})

const medicationSchema = z.object({
  rawText: z.string(),
  normalizedName: z.string(),
  purpose: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence: z.string(),
  sourceIds: z.array(z.string()).default([]),
})

const extractionSchema = z.object({
  medicalConditions: z.array(extractedItemSchema),
  chronicIllnesses: z.array(extractedItemSchema),
  pastSurgeries: z.array(extractedItemSchema),
  medications: z.array(medicationSchema),
  allergies: z.array(extractedItemSchema),
  symptoms: z.array(extractedItemSchema),
  abnormalLabs: z.array(extractedItemSchema),
  imagingFindings: z.array(extractedItemSchema),
  utilizationSignals: z.object({
    recentHospitalization: z.boolean(),
    recentEmergencyCare: z.boolean(),
    followUpNeeded: z.boolean(),
    utilizationEvidence: z.array(z.string()).default([]),
  }),
  normalizedClinicalSummary: z.string(),
})

const featureValueSchema = z.union([z.string(), z.number(), z.boolean()])

const featureSchema = z.object({
  demographics: z.object({
    age: z.number().int(),
    ageBand: z.enum(['child', 'young_adult', 'adult', 'older_adult', 'senior']),
    nationality: z.string(),
  }),
  counts: z.object({
    conditionCount: z.number().int().min(0),
    chronicConditionCount: z.number().int().min(0),
    medicationCount: z.number().int().min(0),
    surgeryCount: z.number().int().min(0),
    allergyCount: z.number().int().min(0),
    abnormalLabCount: z.number().int().min(0),
  }),
  conditionFlags: z.object({
    hasCardiometabolicDisease: z.boolean(),
    hasRespiratoryDisease: z.boolean(),
    hasMentalHealthCondition: z.boolean(),
    hasCancerHistory: z.boolean(),
    hasAutoimmuneDisease: z.boolean(),
    hasKidneyDisease: z.boolean(),
    hasLiverDisease: z.boolean(),
    hasNeurologicDisease: z.boolean(),
  }),
  medicationFlags: z.object({
    hasPolypharmacy: z.boolean(),
    hasInsulinOrGlucoseLoweringTherapy: z.boolean(),
    hasAnticoagulant: z.boolean(),
    hasImmunosuppressant: z.boolean(),
    hasControlledMedication: z.boolean(),
  }),
  utilizationFlags: z.object({
    recentHospitalization: z.boolean(),
    recentEmergencyCare: z.boolean(),
    needsNearTermFollowUp: z.boolean(),
  }),
  derivedIndicators: z.object({
    overallClinicalRisk: z.enum(['low', 'moderate', 'high', 'very_high']),
    followUpUrgency: z.enum(['routine', 'soon', 'urgent']),
    evidenceCompleteness: z.enum(['limited', 'moderate', 'rich']),
  }),
  featureVector: z.record(z.string(), featureValueSchema),
  classifierInputVersion: z.literal('v1'),
  narrativeRationale: z.string(),
})

export type MedicalFeaturePipelineInput = z.infer<typeof medicalFeaturePipelineInputSchema>
export type MedicalExtractionResult = z.infer<typeof extractionSchema>
export type MedicalMlFeatures = z.infer<typeof featureSchema>

function normalizeWhitespace(value: string) {
  return value.trim().split(/\s+/).join(' ')
}

function buildSourceId(document: z.infer<typeof uploadedDocumentSchema>, index: number) {
  return document.id ?? document.fileName ?? `${document.documentType}-${index + 1}`
}

function aggregateInputText(input: MedicalFeaturePipelineInput) {
  const dedupeMap = new Map<string, { sourceId: string; label: string; text: string }>()

  const historyText = normalizeWhitespace(input.patientMedicalHistory)
  if (historyText) {
    dedupeMap.set(historyText.toLowerCase(), {
      sourceId: 'patient-history',
      label: 'Patient medical history',
      text: historyText,
    })
  }

  input.uploadedMedicalDocuments.forEach((document, index) => {
    const text = normalizeWhitespace(document.text)
    if (!text) {
      return
    }

    const key = text.toLowerCase()
    if (!dedupeMap.has(key)) {
      dedupeMap.set(key, {
        sourceId: buildSourceId(document, index),
        label: `${document.documentType}${document.fileName ? ` (${document.fileName})` : ''}`,
        text,
      })
    }
  })

  const sourceEntries = [...dedupeMap.values()]

  return {
    sourceEntries,
    combinedContext: sourceEntries
      .map((entry) => `[${entry.sourceId}] ${entry.label}\n${entry.text}`)
      .join('\n\n'),
  }
}

function getAgeBand(age: number) {
  if (age <= 17) return 'child'
  if (age <= 34) return 'young_adult'
  if (age <= 54) return 'adult'
  if (age <= 74) return 'older_adult'
  return 'senior'
}

async function extractMedicalEntities(input: MedicalFeaturePipelineInput, combinedContext: string) {
  return generateStructuredObject({
    model: extractionModelName,
    schema: extractionSchema,
    system:
      'You are a medical data extraction engine. Read the patient medical history and uploaded medical text, deduplicate repeated facts, normalize medical terminology, and return only structured evidence-supported clinical data. Use the LLM for semantic understanding, medical normalization, and risk-aware interpretation. Do not invent facts. Mark uncertain items with lower confidence. Source IDs must match the provided source tags.',
    prompt: [
      'Extract medically relevant entities from the following patient intake packet.',
      '',
      'Patient demographics:',
      JSON.stringify(input.patientDemographics, null, 2),
      '',
      'Return normalized conditions, chronic illnesses, surgeries, medications, allergies, symptoms, abnormal labs, imaging findings, utilization signals, and a concise clinical summary.',
      '',
      'Clinical text:',
      combinedContext || 'No medical text provided.',
    ].join('\n'),
  })
}

async function deriveMlFeatures(
  input: MedicalFeaturePipelineInput,
  extraction: MedicalExtractionResult,
) {
  return generateStructuredObject({
    model: extractionModelName,
    schema: featureSchema,
    system:
      'You convert extracted clinical evidence into machine-learning-ready classifier features. Use LLM reasoning for condition grouping, risk categorization, and inferred health indicators. Output a conservative, evidence-grounded feature set for a downstream decision tree. FeatureVector values must be booleans, numbers, or short category strings only.',
    prompt: [
      'Transform the extracted clinical information into a compact structured feature payload.',
      '',
      'Patient demographics:',
      JSON.stringify(
        {
          ...input.patientDemographics,
          ageBand: getAgeBand(input.patientDemographics.age),
        },
        null,
        2,
      ),
      '',
      'Extracted clinical evidence:',
      JSON.stringify(extraction, null, 2),
      '',
      'Requirements:',
      '- Ground features in the extracted evidence.',
      '- Use normalized condition groupings rather than raw strings.',
      '- Set overallClinicalRisk and followUpUrgency conservatively.',
      '- Build featureVector with flattened classifier-friendly keys.',
      '- Keep narrativeRationale concise and specific.',
    ].join('\n'),
  })
}

export async function buildMedicalMlFeatures(rawInput: unknown) {
  const input = medicalFeaturePipelineInputSchema.parse(rawInput)
  const { sourceEntries, combinedContext } = aggregateInputText(input)
  const extraction = await extractMedicalEntities(input, combinedContext)
  const features = await deriveMlFeatures(input, extraction)

  return {
    input,
    sourceEntries,
    extraction,
    features,
  }
}
