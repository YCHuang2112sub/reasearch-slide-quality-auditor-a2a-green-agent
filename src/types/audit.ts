export interface AuditResult {
    pageNumber: number;
    explicitDescription: string;
    r2n_retention: number;
    r2n_authenticity: number;
    r2n_risk: number;
    r2s_retention: number;
    r2s_authenticity: number;
    r2s_risk: number;
    n2s_retention: number;
    n2s_authenticity: number;
    n2s_risk: number;
    clarityScore: number;
    logicScore: number;
    visualDensity: string;
    focalPoint: string;
    internalAlignment: number;
    narrativeFlow: number;
    totalScore: number;
    narrativeVerdict: string;
    critique: string;
    layoutSchematic: string;
}

export type ModelType = 'gemini-1.5-flash' | 'gemini-1.5-flash-lite';

export interface SlideData {
    title: string;
    researchPlan: string;
    findings: string;
    speakerNote?: string;
}
