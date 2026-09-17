import type { ChatResponse } from './provider'
import type { PromptDebugTrace } from '../../types/domain'

type Diagnostics = NonNullable<PromptDebugTrace['apiResponseDiagnostics']>

/** A conservative text heuristic, never treated as evidence of which service imposed a restriction. */
export function containsAssistantSelfRefusal(text: string): boolean {
  const beginning = text.trim().replace(/^[\s“”"'「」]+/u, '')
  return /^(?:我(?:不能|无法|不可以|不能够)(?:继续|参与|进行|提供|代入|扮演|协助)|作为(?:人工智能|AI)(?:，|,)?我(?:无法|不能)|抱歉[，,]?我(?:无法|不能)|I\s+(?:can(?:not|'t)|am unable to)\s+(?:continue|participate|provide|roleplay))/iu.test(beginning)
}

export function diagnoseApiResponse(response: ChatResponse): Diagnostics {
  const structuredRefusal = response.refusalMarker === true || response.finishReason === 'content_filter'
  const textRefusal = containsAssistantSelfRefusal(response.text)
  return {
    httpStatus: response.httpStatus,
    finishReason: response.finishReason,
    structuredRefusal,
    textRefusal,
    outcome: structuredRefusal ? 'structured-refusal' : textRefusal ? 'text-refusal' : 'no-refusal-indicator'
  }
}

export function diagnoseApiHttpError(status: number): Diagnostics {
  return { httpStatus: status, structuredRefusal: false, textRefusal: false, outcome: 'http-error' }
}
