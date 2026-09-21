export interface Score {
  id: string;
  user_id: string;
  score: number;
  played_on: string; // Plain "YYYY-MM-DD"
  created_at: string;
}

export interface ScoreInput {
  score: number;
  played_on: string;
}

export interface ScoreValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ScoreInsertPlan {
  allowed: boolean;
  reason?: string;
  willReplace?: Score;
}
