/**
 * Extracts JSON from AI response content that may be wrapped in markdown code blocks
 */
export function extractJsonFromResponse(content: string): unknown {
  // Remove markdown code blocks if present
  let jsonString = content.trim();

  // Check if wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = jsonString.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON from AI response: ${message}\nContent: ${jsonString}`);
  }
}

/**
 * Extracts content from OpenAI chat completion response
 * Content can be a string or already parsed object (for local providers with json_object format)
 */
export function extractContentFromResponse(response: unknown): unknown {
  if (typeof response === 'string') {
    return response;
  }

  // Handle OpenAI response format
  if (
    typeof response === 'object' &&
    response !== null &&
    'choices' in response &&
    Array.isArray(response.choices) &&
    response.choices.length > 0
  ) {
    const choice = response.choices[0];
    if (
      typeof choice === 'object' &&
      choice !== null &&
      'message' in choice &&
      typeof choice.message === 'object' &&
      choice.message !== null &&
      'content' in choice.message
    ) {
      return choice.message.content; // Can be string or object
    }
  }

  // Handle local provider format (Ollama)
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response &&
    typeof response.message === 'object' &&
    response.message !== null &&
    'content' in response.message
  ) {
    return response.message.content; // Can be string or object
  }

  throw new Error('Unable to extract content from AI response');
}

/**
 * Extracts and parses JSON from AI chat completion response
 * Handles both OpenAI and local provider response formats
 * If content is already an object (pre-parsed by local provider), returns it directly
 */
export function extractJsonFromAIResponse(response: unknown): unknown {
  const content = extractContentFromResponse(response);

  // If content is already an object (pre-parsed by local provider), return it
  if (typeof content === 'object' && content !== null) {
    return content;
  }

  // If content is a string, parse it
  if (typeof content === 'string') {
    return extractJsonFromResponse(content);
  }

  throw new Error('Unexpected content type from AI response');
}
