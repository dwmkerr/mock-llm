import * as jmespath from 'jmespath';

export function renderTemplate(template: string, context: Record<string, unknown>): string {
  let result = template;

  // Replace {{timestamp}} with current milliseconds
  result = result.replace(/\{\{timestamp\}\}/g, () => Date.now().toString());

  // Replace {{jmes contextKey path}} with JMESPath query result
  result = result.replace(/\{\{jmes\s+(\w+)\s+([^}]+)\}\}/g, (_, contextKey, path) => {
    const obj = context[contextKey];
    const value = jmespath.search(obj, path);

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  });

  return result;
}
