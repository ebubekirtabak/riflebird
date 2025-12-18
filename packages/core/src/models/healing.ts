export type HealingAttempt = {
  attemptNumber: number;
  previousTestCode?: string;
  errorMessage?: string;
  testOutput?: string;
};

export type HealingResult = {
  success: boolean;
  attempts: number;
  finalTestCode?: string;
  error?: string;
};
