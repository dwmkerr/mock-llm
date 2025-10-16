import { Config } from './config';

export function printConfigSummary(config: Config, message: string) {
  console.log(message);
  config.rules.forEach((rule, index) => {
    console.log(`  - rule ${index + 1}, match: ${rule.match}`);
  });
}
