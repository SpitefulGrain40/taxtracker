import Anthropic from '@anthropic-ai/sdk'
import type { Payslip, LineItem } from '../types'

// ─── Raw extraction shape returned by Claude ─────────────────────────────────

interface RawPayslipExtraction {
  basicSalary: number
  carAllowance: number
  taxPaid: number
  employeeNI: number
  esppContribution: number
  employerMatch: number
  salarySacrifice: LineItem[]
  otherPayments: LineItem[]
  ytdGross: number
  ytdTaxPaid: number
  ytdEmployeeNI: number
  taxCode: string
  niNumber: string
  employerName: string
  payDate: string
  rstVestIncome?: number | null
}

// ─── Parse helper (pure, testable without API) ────────────────────────────────

export function parsePayslipResponse(jsonText: string): Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> {
  const raw = JSON.parse(jsonText) as RawPayslipExtraction
  const requiredNumbers: (keyof RawPayslipExtraction)[] = ['basicSalary', 'taxPaid', 'employeeNI', 'ytdGross', 'ytdTaxPaid', 'ytdEmployeeNI']
  for (const field of requiredNumbers) {
    if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field] as number)) {
      throw new Error(`Payslip extraction missing or invalid field: ${field}`)
    }
  }
  return {
    date: raw.payDate,
    basicSalary: raw.basicSalary,
    carAllowance: raw.carAllowance ?? 0,
    taxPaid: raw.taxPaid,
    employeeNI: raw.employeeNI,
    esppContribution: raw.esppContribution ?? 0,
    employerMatch: raw.employerMatch ?? 0,
    salarySacrifice: raw.salarySacrifice ?? [],
    otherPayments: raw.otherPayments ?? [],
    ytdGross: raw.ytdGross,
    ytdTaxPaid: raw.ytdTaxPaid,
    ytdEmployeeNI: raw.ytdEmployeeNI,
    taxCode: raw.taxCode,
    niNumber: raw.niNumber,
    employerName: raw.employerName,
    ...(raw.rstVestIncome != null ? { rstVestIncome: raw.rstVestIncome } : {}),
  }
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const PAYSLIP_SYSTEM = `You are a UK payslip data extractor. Extract all numerical values exactly as printed — do not recalculate. Return ONLY valid JSON, no prose.`

const PAYSLIP_SCHEMA = `{
  "basicSalary": number,
  "carAllowance": number,
  "taxPaid": number,
  "employeeNI": number,
  "esppContribution": number,
  "employerMatch": number,
  "salarySacrifice": [{"label": string, "amount": number}],
  "otherPayments": [{"label": string, "amount": number}],
  "ytdGross": number,
  "ytdTaxPaid": number,
  "ytdEmployeeNI": number,
  "taxCode": string,
  "niNumber": string,
  "employerName": string,
  "payDate": "YYYY-MM-DD",
  "rstVestIncome": number | null
}`

// ─── API call ─────────────────────────────────────────────────────────────────

export async function extractPayslip(
  apiKey: string,
  fileBase64: string,
  mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> & { rawExtracted: Record<string, string> }> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system: PAYSLIP_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          mediaType === 'application/pdf'
            ? {
                type: 'document' as const,
                source: { type: 'base64' as const, media_type: mediaType, data: fileBase64 },
              }
            : {
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: fileBase64 },
              },
          {
            type: 'text' as const,
            text: `Extract all payslip fields. Return JSON matching this schema exactly:\n${PAYSLIP_SCHEMA}\n\nFor salarySacrifice: include all negative deductions like pension contributions, critical illness, cycle to work, etc. For otherPayments: include any additional positive payments beyond basic salary and car allowance. Set rstVestIncome to null unless there is a clear one-off RSU/share vest income line.`,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')

  if (response.stop_reason !== 'end_turn') {
    throw new Error(`Extraction incomplete: stop_reason was "${response.stop_reason}". Try a higher-quality scan.`)
  }

  // Strip markdown code fences if present
  let jsonText = textBlock.text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  const parsed = parsePayslipResponse(jsonText)
  return { ...parsed, rawExtracted: { payslip: jsonText } }
}
